"""Integração entre módulos — Sprint 2.

Verifica que uma mudança em um módulo repercute nos outros, que é o objetivo do
barramento de eventos (lib/project-events.ts).
"""

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, aguardar_carregamento, api, corpo


def preparar(driver, projeto_id, status_requisito="Em Aberto"):
    requisito = api(
        driver,
        "POST",
        f"/api/projects/{projeto_id}/requirements",
        {
            "description": "O rover deve desviar de obstáculos.",
            "category": "Funcional",
            "priority": "Alta",
            "status": status_requisito,
        },
    )["data"]["requirement"]

    tarefa = api(
        driver,
        "POST",
        f"/api/projects/{projeto_id}/tasks",
        {"title": "Implementar desvio de obstáculos", "requirementId": requisito["id"]},
    )["data"]["task"]

    return requisito, tarefa


def test_descartar_requisito_avisa_tarefas_abertas(autenticado, projeto):
    """Requisitos → Kanban: descartar avisa que há tarefa aberta."""
    driver = autenticado
    requisito, _ = preparar(driver, projeto["id"])

    resposta = api(
        driver,
        "PATCH",
        f"/api/projects/{projeto['id']}/requirements/{requisito['id']}",
        {"status": "Descartado"},
    )
    assert resposta["status"] == 200

    efeitos = resposta["data"]["effects"]
    assert any(e["kind"] == "tasks_of_discarded_requirement" for e in efeitos), efeitos
    assert "continua aberta" in efeitos[0]["message"]


def test_card_do_kanban_sinaliza_requisito_descartado(autenticado, base_url, projeto):
    """O aviso chega até a interface do quadro."""
    driver = autenticado
    requisito, _ = preparar(driver, projeto["id"])
    api(
        driver,
        "PATCH",
        f"/api/projects/{projeto['id']}/requirements/{requisito['id']}",
        {"status": "Descartado"},
    )

    driver.get(f"{base_url}/dashboard/projects/{projeto['id']}/kanban")
    WebDriverWait(driver, TIMEOUT).until(lambda d: "foi descartado" in corpo(d))
    assert f"Requisito {requisito['code']} foi descartado" in corpo(driver)


def test_restaurar_requisito_avisa_tarefas_reativadas(autenticado, projeto):
    driver = autenticado
    requisito, _ = preparar(driver, projeto["id"])
    api(
        driver,
        "PATCH",
        f"/api/projects/{projeto['id']}/requirements/{requisito['id']}",
        {"status": "Descartado"},
    )

    resposta = api(
        driver,
        "PATCH",
        f"/api/projects/{projeto['id']}/requirements/{requisito['id']}",
        {"status": "Em Aberto"},
    )
    efeitos = resposta["data"]["effects"]
    assert any(e["kind"] == "tasks_of_restored_requirement" for e in efeitos), efeitos


def test_concluir_ultima_tarefa_sugere_validar_requisito(autenticado, projeto):
    """Kanban → Requisitos: cobertura completa sugere validar (sem alterar sozinho)."""
    driver = autenticado
    requisito, tarefa = preparar(driver, projeto["id"])

    concluido = next(
        c
        for c in api(driver, "GET", f"/api/projects/{projeto['id']}/columns")["data"]["columns"]
        if c["isDone"]
    )
    resposta = api(
        driver,
        "PATCH",
        f"/api/projects/{projeto['id']}/tasks/{tarefa['id']}",
        {"columnId": concluido["id"]},
    )

    efeitos = resposta["data"]["effects"]
    assert any(e["kind"] == "requirement_fully_covered" for e in efeitos), efeitos

    # A sugestão não altera o requisito automaticamente.
    atual = api(driver, "GET", f"/api/projects/{projeto['id']}/requirements")["data"]["requirements"]
    assert next(r for r in atual if r["id"] == requisito["id"])["status"] == "Em Aberto"


def test_requisito_ja_validado_nao_gera_sugestao(autenticado, projeto):
    driver = autenticado
    _, tarefa = preparar(driver, projeto["id"], status_requisito="Validado")

    concluido = next(
        c
        for c in api(driver, "GET", f"/api/projects/{projeto['id']}/columns")["data"]["columns"]
        if c["isDone"]
    )
    resposta = api(
        driver,
        "PATCH",
        f"/api/projects/{projeto['id']}/tasks/{tarefa['id']}",
        {"columnId": concluido["id"]},
    )
    assert resposta["data"]["effects"] == []


def test_listagem_de_requisitos_traz_cobertura_e_custo(autenticado, base_url, projeto):
    """Kanban e Custos → Requisitos: cobertura e custo na mesma listagem."""
    driver = autenticado
    requisito, _ = preparar(driver, projeto["id"])

    api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/components",
        {
            "name": "Sensor infravermelho",
            "quantity": 2,
            "unitPrice": 7.5,
            "requirementId": requisito["id"],
        },
    )

    dados = api(driver, "GET", f"/api/projects/{projeto['id']}/requirements")["data"]
    linha = next(r for r in dados["requirements"] if r["id"] == requisito["id"])

    assert linha["tasksTotal"] == 1
    assert linha["tasksDone"] == 0
    assert linha["componentsTotal"] == 1
    assert linha["estimatedCost"] == 15.0

    driver.get(f"{base_url}/dashboard/projects/{projeto['id']}/requirements")
    aguardar_carregamento(driver)
    WebDriverWait(driver, TIMEOUT).until(lambda d: "0/1" in corpo(d))

    texto = corpo(driver)
    assert "COBERTURA" in texto.upper()
    assert "15,00" in texto


def test_requisito_sem_tarefa_e_sinalizado(autenticado, base_url, projeto):
    """RF14: requisito sem cobertura aparece destacado na tabela."""
    driver = autenticado
    api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/requirements",
        {"description": "Requisito sem tarefa.", "category": "Funcional", "priority": "Baixa"},
    )

    driver.get(f"{base_url}/dashboard/projects/{projeto['id']}/requirements")
    aguardar_carregamento(driver)
    WebDriverWait(driver, TIMEOUT).until(lambda d: "Sem tarefa" in corpo(d))
