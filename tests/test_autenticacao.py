"""Autenticação e proteção de rotas (RNF05)."""

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT


def test_tela_de_login_em_portugues(driver, base_url):
    driver.get(f"{base_url}/login")
    WebDriverWait(driver, TIMEOUT).until(
        EC.presence_of_element_located((By.ID, "login-email"))
    )

    corpo = driver.find_element(By.TAG_NAME, "body").text
    assert "Bem-vindo de volta" in corpo
    assert "Entrar" in corpo
    assert "Criar conta" in corpo


def test_rota_protegida_redireciona_para_login(driver, base_url):
    """Sem sessão, /dashboard deve levar para /login (RNF05)."""
    driver.delete_all_cookies()
    driver.get(f"{base_url}/dashboard/projects")

    WebDriverWait(driver, TIMEOUT).until(EC.url_contains("/login"))
    assert "/login" in driver.current_url


def test_credenciais_invalidas_mostram_erro(driver, base_url):
    driver.delete_all_cookies()
    driver.get(f"{base_url}/login")

    wait = WebDriverWait(driver, TIMEOUT)
    wait.until(EC.presence_of_element_located((By.ID, "login-email"))).send_keys(
        "nao-existe@exemplo.invalido"
    )
    driver.find_element(By.ID, "login-password").send_keys("senha-incorreta")
    driver.find_element(By.CSS_SELECTOR, "form button[type='submit']").click()

    # Não pode autenticar: permanece em /login e exibe mensagem de erro.
    wait.until(
        lambda d: "inválid" in d.find_element(By.TAG_NAME, "body").text.lower()
        or "incorret" in d.find_element(By.TAG_NAME, "body").text.lower()
    )
    assert "/dashboard" not in driver.current_url


def test_login_valido_chega_ao_dashboard(autenticado, base_url):
    """A fixture `autenticado` faz o login; aqui confirmamos o resultado."""
    assert "/dashboard" in autenticado.current_url

    autenticado.get(f"{base_url}/dashboard/projects")
    WebDriverWait(autenticado, TIMEOUT).until(
        EC.presence_of_element_located((By.TAG_NAME, "main"))
    )
    assert "Projetos" in autenticado.find_element(By.TAG_NAME, "body").text
