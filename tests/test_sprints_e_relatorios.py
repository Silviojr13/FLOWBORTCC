"""Sprints (RF08 / UC07, UC13) e Relatórios (RF13, RF15 / UC11)."""

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, aguardar_carregamento, api, corpo


def criar_tarefa(driver, projeto_id, titulo, **campos):
    resposta = api(
        driver, "POST", f"/api/projects/{projeto_id}/tasks", {"title": titulo, **campos}
    )
    assert resposta["status"] == 201, resposta
    return resposta["data"]["task"]


# ---------------------------------------------------------------------------
# Sprints
# ---------------------------------------------------------------------------


def test_sprint_exige_ao_menos_uma_tarefa(autenticado, projeto):
    """UC07, fluxo de exceção: sem tarefa selecionada o planejamento é recusado."""
    driver = autenticado
    resposta = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/sprints",
        {
            "name": "Sprint vazia",
            "startDate": "2026-10-01",
            "endDate": "2026-10-15",
            "taskIds": [],
        },
    )
    assert resposta["status"] == 400
    assert "tarefa" in resposta["data"]["error"].lower()


def test_sprint_rejeita_periodo_invertido(autenticado, projeto):
    driver = autenticado
    tarefa = criar_tarefa(driver, projeto["id"], "Tarefa da sprint")

    resposta = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/sprints",
        {
            "name": "Sprint com datas trocadas",
            "startDate": "2026-10-20",
            "endDate": "2026-10-05",
            "taskIds": [tarefa["id"]],
        },
    )
    assert resposta["status"] == 400


def test_planejar_sprint_e_acompanhar_progresso(autenticado, base_url, projeto):
    """RF08 + UC13: sprint criada com tarefas e progresso calculado."""
    driver = autenticado
    t1 = criar_tarefa(driver, projeto["id"], "Integrar sensor", assignee="Ana")
    t2 = criar_tarefa(driver, projeto["id"], "Escrever firmware", assignee="Bruno")

    criada = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/sprints",
        {
            "name": "Sprint 1 — Testes",
            "goal": "Fechar a primeira integração",
            "startDate": "2026-10-01",
            "endDate": "2026-10-15",
            "taskIds": [t1["id"], t2["id"]],
        },
    )
    assert criada["status"] == 201, criada
    sprint = criada["data"]["sprint"]
    assert sprint["tasksTotal"] == 2
    assert sprint["tasksDone"] == 0

    # Concluir uma das tarefas deve refletir no progresso da sprint.
    concluido = next(
        c
        for c in api(driver, "GET", f"/api/projects/{projeto['id']}/columns")["data"]["columns"]
        if c["isDone"]
    )
    api(
        driver,
        "PATCH",
        f"/api/projects/{projeto['id']}/tasks/{t1['id']}",
        {"columnId": concluido["id"]},
    )

    detalhe = api(driver, "GET", f"/api/projects/{projeto['id']}/sprints/{sprint['id']}")
    assert detalhe["status"] == 200
    assert detalhe["data"]["sprint"]["tasksDone"] == 1
    assert detalhe["data"]["byAssignee"]["Ana"]["done"] == 1

    driver.get(f"{base_url}/dashboard/projects/{projeto['id']}/sprints")
    WebDriverWait(driver, TIMEOUT).until(lambda d: "Sprint 1 — Testes" in corpo(d))
    assert "Fechar a primeira integração" in corpo(driver)


# ---------------------------------------------------------------------------
# Relatórios
# ---------------------------------------------------------------------------


def test_relatorio_consolida_dados_do_projeto(autenticado, projeto):
    """RF13: resumo, progresso por sprint e por módulo, requisitos e custos."""
    driver = autenticado
    requisito = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/requirements",
        {"description": "O sistema deve medir distância.", "category": "Funcional", "priority": "Alta"},
    )["data"]["requirement"]

    api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/components",
        {"name": "Sensor ultrassônico", "quantity": 2, "unitPrice": 12.5, "requirementId": requisito["id"]},
    )
    criar_tarefa(driver, projeto["id"], "Ligar o sensor", requirementId=requisito["id"])

    relatorio = api(driver, "GET", f"/api/projects/{projeto['id']}/report?type=completo")
    assert relatorio["status"] == 200
    resumo = relatorio["data"]["report"]["summary"]

    assert resumo["requirementsTotal"] == 1
    assert resumo["tasksTotal"] == 1
    assert resumo["componentsTotal"] == 1
    assert resumo["totalCost"] == 25.0


def test_relatorio_avisa_periodo_sem_dados(autenticado, projeto):
    """UC11, fluxo de exceção: período sem dados é sinalizado."""
    driver = autenticado
    criar_tarefa(driver, projeto["id"], "Tarefa fora do período", dueDate="2026-11-10")

    relatorio = api(
        driver,
        "GET",
        f"/api/projects/{projeto['id']}/report?type=progresso&from=2020-01-01&to=2020-01-31",
    )
    assert relatorio["status"] == 200
    assert relatorio["data"]["report"]["hasDataInPeriod"] is False


def test_relatorio_rejeita_periodo_invertido(autenticado, projeto):
    driver = autenticado
    resposta = api(
        driver, "GET", f"/api/projects/{projeto['id']}/report?from=2026-10-10&to=2026-10-01"
    )
    assert resposta["status"] == 400


def test_tela_de_relatorios_abre_com_exportacoes(autenticado, base_url, projeto):
    """RF15: a tela oferece PDF, CSV e Markdown."""
    driver = autenticado
    driver.get(f"{base_url}/dashboard/projects/{projeto['id']}/report")
    # O título usa text-transform: uppercase, então a comparação ignora a caixa.
    WebDriverWait(driver, TIMEOUT).until(
        lambda d: "relatório do projeto" in corpo(d).lower()
    )
    aguardar_carregamento(driver)

    texto = corpo(driver)
    for rotulo in ["Exportar PDF", "Exportar CSV", "Exportar Markdown"]:
        assert rotulo in texto, f"Botão de exportação ausente: {rotulo}"
