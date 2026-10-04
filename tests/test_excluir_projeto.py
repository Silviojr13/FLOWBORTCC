"""Exclusão de projeto pela interface, com confirmação pelo nome."""

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, api, corpo


def test_previa_mostra_o_que_sera_apagado(autenticado, projeto):
    driver = autenticado
    requisito = api(
        driver, "POST", f"/api/projects/{projeto['id']}/requirements",
        {"description": "Medir distância.", "category": "Funcional", "priority": "Alta"},
    )["data"]["requirement"]
    api(driver, "POST", f"/api/projects/{projeto['id']}/tasks", {"title": "Ligar sensor", "requirementId": requisito["id"]})

    previa = api(driver, "GET", f"/api/projects/{projeto['id']}/delete-preview")
    assert previa["status"] == 200
    assert previa["data"]["counts"]["requirements"] == 1
    assert previa["data"]["counts"]["tasks"] == 1


def test_exclusao_exige_digitar_o_nome(autenticado, base_url, projeto):
    driver = autenticado
    driver.get(f"{base_url}/dashboard/projects")
    wait = WebDriverWait(driver, TIMEOUT)
    menu = wait.until(EC.element_to_be_clickable(
        (By.CSS_SELECTOR, f'button[aria-label="Ações do projeto {projeto["nome"]}"]')
    ))
    menu.click()
    wait.until(EC.element_to_be_clickable((By.XPATH, "//*[@role='menuitem'][contains(., 'Excluir projeto')]"))).click()

    campo = wait.until(EC.visibility_of_element_located((By.ID, "delete-project-confirm")))
    botao = driver.find_element(By.XPATH, "//*[@role='dialog']//button[normalize-space()='Excluir projeto']")
    assert not botao.is_enabled()

    campo.send_keys(projeto["nome"])
    wait.until(lambda d: botao.is_enabled())
    botao.click()

    wait.until(lambda d: projeto["nome"] not in corpo(d))
    assert api(driver, "GET", f"/api/projects/{projeto['id']}/delete-preview")["status"] == 404
