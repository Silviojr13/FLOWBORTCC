"""Módulo de Gestão de Requisitos (RF01–RF04, RNF04)."""

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, aguardar_carregamento, api, corpo


def abrir_requisitos(driver, base_url, projeto_id):
    driver.get(f"{base_url}/dashboard/projects/{projeto_id}?step=requisitos")
    WebDriverWait(driver, TIMEOUT).until(
        EC.presence_of_element_located((By.TAG_NAME, "table"))
    )
    aguardar_carregamento(driver)


def test_codigo_sequencial_por_categoria(autenticado, base_url, projeto):
    """RF01: o código (RF01, RNF01...) é gerado automaticamente por categoria."""
    driver = autenticado
    for descricao, categoria in [
        ("O sistema deve ligar o motor principal.", "Funcional"),
        ("O sistema deve parar em caso de falha.", "Funcional"),
        ("O consumo deve ficar abaixo de 2 W.", "Não Funcional"),
    ]:
        resposta = api(
            driver,
            "POST",
            f"/api/projects/{projeto['id']}/requirements",
            {"description": descricao, "category": categoria, "priority": "Alta"},
        )
        assert resposta["status"] == 201, resposta

    abrir_requisitos(driver, base_url, projeto["id"])
    texto = corpo(driver)

    assert "RF01" in texto and "RF02" in texto, "Requisitos funcionais devem numerar RF01, RF02"
    assert "RNF01" in texto, "Requisitos não funcionais devem numerar a partir de RNF01"


def test_criar_requisito_pela_interface(autenticado, base_url, projeto):
    """RF01: cadastro pela tela, com categoria, prioridade e status."""
    driver = autenticado
    abrir_requisitos(driver, base_url, projeto["id"])
    wait = WebDriverWait(driver, TIMEOUT)

    descricao = "O sistema deve registrar a temperatura a cada 10 segundos."

    botao_adicionar = wait.until(
        EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., 'Adicionar requisito')]")
        )
    )
    botao_adicionar.click()

    campo = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "table input")))
    campo.send_keys(descricao)

    driver.find_element(By.CSS_SELECTOR, "button[aria-label='Salvar']").click()

    wait.until(lambda d: descricao in corpo(d))
    assert "RF01" in corpo(driver)


def test_edicao_registra_historico(autenticado, projeto):
    """RF03 / RNF04: cada alteração guarda a versão anterior."""
    driver = autenticado
    criado = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/requirements",
        {"description": "Descrição original.", "category": "Funcional", "priority": "Média"},
    )
    assert criado["status"] == 201
    req_id = criado["data"]["requirement"]["id"]

    alterado = api(
        driver,
        "PATCH",
        f"/api/projects/{projeto['id']}/requirements/{req_id}",
        {"description": "Descrição revisada após análise."},
    )
    assert alterado["status"] == 200

    historico = api(
        driver, "GET", f"/api/projects/{projeto['id']}/requirements/{req_id}/history"
    )
    assert historico["status"] == 200
    versoes = historico["data"]["history"]
    assert len(versoes) == 1, "A alteração deveria gerar exatamente uma versão anterior"
    assert versoes[0]["description"] == "Descrição original."


def test_nivel_de_abstracao_e_persistido(autenticado, projeto):
    """RF04: classificação por nível (Sistema, Subsistema, Componente)."""
    driver = autenticado
    criado = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/requirements",
        {
            "description": "O subsistema de tração deve ter controle independente por roda.",
            "category": "Funcional",
            "priority": "Alta",
            "level": "Subsistema",
        },
    )
    assert criado["status"] == 201
    assert criado["data"]["requirement"]["level"] == "Subsistema"


def test_rejeita_categoria_invalida(autenticado, projeto):
    """A API valida os valores aceitos em vez de gravar qualquer coisa."""
    driver = autenticado
    resposta = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/requirements",
        {"description": "Requisito com categoria errada.", "category": "Outra", "priority": "Alta"},
    )
    assert resposta["status"] == 400
