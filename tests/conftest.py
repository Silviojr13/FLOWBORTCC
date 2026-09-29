"""Configuração comum dos testes de integração (Selenium) do FlowBot.

Os testes rodam contra a aplicação em execução (desenvolvimento ou homologação) e usam
uma conta real de teste, cujas credenciais vêm de variáveis de ambiente — nada é fixado
no código:

    FLOWBOT_BASE_URL       URL da aplicação (padrão: http://localhost:3000)
    FLOWBOT_TEST_EMAIL     e-mail da conta de teste
    FLOWBOT_TEST_PASSWORD  senha da conta de teste
    FLOWBOT_BROWSER        chrome | edge (padrão: chrome, com edge como alternativa)
    FLOWBOT_HEADLESS       0 para acompanhar a execução na tela (padrão: 1)

Cada teste que precisa de dados cria seu próprio projeto com nome único e o remove ao
final, de modo que a suíte não interfere nos projetos existentes.
"""

import os
import uuid

import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

TIMEOUT = 20


def _env_flag(name: str, default: str = "1") -> bool:
    return os.environ.get(name, default).strip().lower() not in {"0", "false", "no"}


@pytest.fixture(scope="session")
def base_url() -> str:
    return os.environ.get("FLOWBOT_BASE_URL", "http://localhost:3000").rstrip("/")


@pytest.fixture(scope="session")
def credentials() -> tuple[str, str]:
    email = os.environ.get("FLOWBOT_TEST_EMAIL")
    password = os.environ.get("FLOWBOT_TEST_PASSWORD")
    if not email or not password:
        pytest.skip(
            "Defina FLOWBOT_TEST_EMAIL e FLOWBOT_TEST_PASSWORD para rodar os testes de integração."
        )
    return email, password


@pytest.fixture(scope="session")
def driver():
    headless = _env_flag("FLOWBOT_HEADLESS")
    browser = os.environ.get("FLOWBOT_BROWSER", "chrome").strip().lower()

    def build(name: str):
        if name == "edge":
            options = webdriver.EdgeOptions()
        else:
            options = webdriver.ChromeOptions()
        if headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1440,900")
        options.add_argument("--disable-gpu")
        return webdriver.Edge(options=options) if name == "edge" else webdriver.Chrome(options=options)

    try:
        instance = build(browser)
    except Exception as first_error:  # navegador preferido indisponível
        fallback = "edge" if browser != "edge" else "chrome"
        try:
            instance = build(fallback)
        except Exception:
            pytest.skip(f"Nenhum navegador disponível para o Selenium: {first_error}")

    instance.set_page_load_timeout(60)
    yield instance
    instance.quit()


@pytest.fixture(scope="session")
def wait(driver):
    return WebDriverWait(driver, TIMEOUT)


@pytest.fixture(scope="session")
def autenticado(driver, wait, base_url, credentials):
    """Faz login uma vez por sessão de testes e mantém o navegador autenticado."""
    email, password = credentials

    driver.get(f"{base_url}/login")
    wait.until(EC.presence_of_element_located((By.ID, "login-email"))).send_keys(email)
    driver.find_element(By.ID, "login-password").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "form button[type='submit']").click()

    wait.until(EC.url_contains("/dashboard"))
    return driver


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------


def api(driver, method: str, path: str, body: dict | None = None):
    """Chama a API da aplicação reaproveitando a sessão autenticada do navegador.

    Usado apenas para preparar e limpar dados; as verificações dos testes passam pela
    interface, que é o que se quer validar.
    """
    script = """
    const method = arguments[0];
    const path = arguments[1];
    const body = arguments[2];
    const done = arguments[arguments.length - 1];
    fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
      .then(async (r) => done({ status: r.status, data: await r.json().catch(() => null) }))
      .catch((e) => done({ status: 0, data: { error: String(e) } }));
    """
    driver.set_script_timeout(60)
    return driver.execute_async_script(script, method, path, body)


def aguardar_carregamento(driver, timeout: int = TIMEOUT) -> None:
    """Espera as telas terminarem de buscar dados.

    A tabela e as colunas já existem no DOM enquanto o fetch acontece, então esperar pelo
    elemento não basta: é preciso esperar os textos de carregamento desaparecerem.
    """
    marcadores = (
        "carregando requisitos",
        "carregando kanban",
        "carregando sprints",
        "carregando conversa",
        "consolidando dados",
        "carregando...",
    )

    WebDriverWait(driver, timeout).until(
        lambda d: not any(
            m in d.find_element(By.TAG_NAME, "body").text.lower() for m in marcadores
        )
    )


def corpo(driver) -> str:
    return driver.find_element(By.TAG_NAME, "body").text


def texto_visivel(driver, texto: str) -> bool:
    return texto.lower() in driver.find_element(By.TAG_NAME, "body").text.lower()


@pytest.fixture
def projeto(autenticado, base_url):
    """Cria um projeto isolado para o teste e o remove ao final."""
    driver = autenticado
    driver.get(f"{base_url}/dashboard/projects")
    WebDriverWait(driver, TIMEOUT).until(EC.url_contains("/dashboard/projects"))

    nome = f"[teste-e2e] {uuid.uuid4().hex[:8]}"
    criado = api(
        driver,
        "POST",
        "/api/projects",
        {"name": nome, "description": "Projeto temporário criado pela suíte de testes."},
    )
    assert criado["status"] == 201, f"Falha ao criar projeto de teste: {criado}"
    projeto_id = criado["data"]["project"]["id"]

    yield {"id": projeto_id, "nome": nome}

    api(driver, "DELETE", f"/api/projects/{projeto_id}")
