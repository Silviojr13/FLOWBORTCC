"""Associação do login com Google a uma conta criada com e-mail e senha."""

from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, api, corpo


def test_pedido_de_associacao_invalido(autenticado):
    driver = autenticado
    assert api(driver, "GET", "/api/auth/link-account?token=inventado")["status"] == 410

    sem_senha = api(driver, "POST", "/api/auth/link-account", {"token": "inventado"})
    assert sem_senha["status"] == 400

    expirado = api(driver, "POST", "/api/auth/link-account", {"token": "inventado", "password": "qualquer1"})
    assert expirado["status"] == 410


def test_tela_de_associacao_expirada(autenticado, base_url):
    driver = autenticado
    driver.get(f"{base_url}/vincular-conta?token=inventado")
    WebDriverWait(driver, TIMEOUT).until(lambda d: "Pedido expirado" in corpo(d))
