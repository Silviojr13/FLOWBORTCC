"""Recuperação de senha por e-mail."""

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, api, corpo


def test_pedido_nao_revela_se_a_conta_existe(autenticado, credentials):
    driver = autenticado
    email, _ = credentials
    existente = api(driver, "POST", "/api/auth/forgot-password", {"email": email})
    inexistente = api(driver, "POST", "/api/auth/forgot-password", {"email": "ninguem@nao-existe.test"})

    assert existente["status"] == inexistente["status"] == 200
    assert existente["data"]["message"] == inexistente["data"]["message"]


def test_pedido_exige_email_valido(autenticado):
    resposta = api(autenticado, "POST", "/api/auth/forgot-password", {"email": "sem-arroba"})
    assert resposta["status"] == 400


def test_link_invalido_e_recusado(autenticado):
    driver = autenticado
    assert api(driver, "GET", "/api/auth/reset-password?token=inventado")["status"] == 410
    troca = api(driver, "POST", "/api/auth/reset-password", {"token": "inventado", "password": "NovaSenha123"})
    assert troca["status"] == 410


def test_tela_de_link_invalido_oferece_novo_pedido(autenticado, base_url):
    driver = autenticado
    driver.get(f"{base_url}/redefinir-senha?token=inventado")
    WebDriverWait(driver, TIMEOUT).until(lambda d: "Link indisponível" in corpo(d))
    assert driver.find_element(By.LINK_TEXT, "Pedir um novo link").get_attribute("href").endswith("/esqueci-senha")
