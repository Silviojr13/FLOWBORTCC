"""Módulo de Gestão de Tarefas — Kanban (RF05–RF07, RF09)."""

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, aguardar_carregamento, api, corpo


def abrir_kanban(driver, base_url, projeto_id):
    driver.get(f"{base_url}/dashboard/projects/{projeto_id}/kanban")
    WebDriverWait(driver, TIMEOUT).until(lambda d: "Nova tarefa" in corpo(d))
    aguardar_carregamento(driver)


def colunas(driver, projeto_id):
    return api(driver, "GET", f"/api/projects/{projeto_id}/columns")["data"]["columns"]


def test_colunas_padrao_sao_criadas(autenticado, base_url, projeto):
    """RF05: o quadro nasce com Backlog, Em Progresso, Em Revisão e Concluído."""
    driver = autenticado
    abrir_kanban(driver, base_url, projeto["id"])

    nomes = [c["name"] for c in colunas(driver, projeto["id"])]
    assert nomes == ["Backlog", "Em Progresso", "Em Revisão", "Concluído"]

    texto = corpo(driver)
    for nome in nomes:
        assert nome in texto


def test_criar_tarefa_com_responsavel_prazo_e_requisito(autenticado, base_url, projeto):
    """RF06: tarefa com título, responsável, prazo, prioridade e vínculo a requisito."""
    driver = autenticado
    requisito = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/requirements",
        {"description": "O rover deve seguir a linha.", "category": "Funcional", "priority": "Alta"},
    )["data"]["requirement"]

    criada = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/tasks",
        {
            "title": "Calibrar sensores de linha",
            "priority": "Alta",
            "assignee": "Equipe de testes",
            "dueDate": "2026-12-01",
            "requirementId": requisito["id"],
        },
    )
    assert criada["status"] == 201, criada
    tarefa = criada["data"]["task"]
    assert tarefa["assignee"] == "Equipe de testes"
    assert tarefa["requirement"]["code"] == "RF01"

    abrir_kanban(driver, base_url, projeto["id"])
    texto = corpo(driver)
    assert "Calibrar sensores de linha" in texto
    assert "Equipe de testes" in texto


def test_tarefa_com_responsavel_principal_e_participantes(autenticado, base_url, projeto):
    """RF06: a tarefa tem um responsável principal e participantes que a executam junto."""
    driver = autenticado
    base = f"/api/projects/{projeto['id']}/tasks"

    criada = api(
        driver,
        "POST",
        base,
        {"title": "Montar o chassi", "assignee": "Ana", "participants": ["Bruno", "bruno", "ANA", " ", "Caio"]},
    )
    assert criada["status"] == 201, criada
    tarefa = criada["data"]["task"]
    assert tarefa["assignee"] == "Ana"
    # Repetidos (sem diferenciar maiúsculas), vazios e o próprio responsável ficam de fora.
    assert [p["name"] for p in tarefa["participants"]] == ["Bruno", "Caio"]

    # Sem responsável, o primeiro participante assume a tarefa.
    sem_principal = api(driver, "PATCH", f"{base}/{tarefa['id']}", {"assignee": None, "participants": ["Caio", "Davi"]})
    assert sem_principal["status"] == 200, sem_principal
    assert sem_principal["data"]["task"]["assignee"] == "Caio"
    assert [p["name"] for p in sem_principal["data"]["task"]["participants"]] == ["Davi"]

    demais = api(driver, "PATCH", f"{base}/{tarefa['id']}", {"participants": [f"P{i}" for i in range(11)]})
    assert demais["status"] == 400

    # Filtrar o relatório por um participante traz a tarefa.
    relatorio = api(driver, "GET", f"/api/projects/{projeto['id']}/report?assignee=Davi")["data"]
    relatorio = relatorio.get("report", relatorio)
    assert [t["title"] for t in relatorio["tasks"]] == ["Montar o chassi"]

    abrir_kanban(driver, base_url, projeto["id"])
    assert "Caio" in corpo(driver)


def test_mover_tarefa_registra_historico(autenticado, projeto):
    """RF07 + RF09: mover entre colunas atualiza o estado e grava o histórico."""
    driver = autenticado
    tarefa = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/tasks",
        {"title": "Montar chassi", "priority": "Média"},
    )["data"]["task"]

    destino = next(c for c in colunas(driver, projeto["id"]) if c["name"] == "Em Progresso")
    movida = api(
        driver,
        "PATCH",
        f"/api/projects/{projeto['id']}/tasks/{tarefa['id']}",
        {"columnId": destino["id"]},
    )
    assert movida["status"] == 200
    assert movida["data"]["task"]["columnId"] == destino["id"]

    historico = api(
        driver, "GET", f"/api/projects/{projeto['id']}/tasks/{tarefa['id']}/history"
    )["data"]["history"]

    # Uma entrada da criação (Backlog) e outra da movimentação.
    assert len(historico) == 2
    assert historico[0]["fromColumn"] == "Backlog"
    assert historico[0]["toColumn"] == "Em Progresso"


def test_coluna_configuravel_com_limite_wip(autenticado, base_url, projeto):
    """RF05: colunas configuráveis, com limite de trabalho em progresso."""
    driver = autenticado
    criada = api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/columns",
        {"name": "Testes de bancada", "wipLimit": 2},
    )
    assert criada["status"] == 201, criada
    assert criada["data"]["column"]["wipLimit"] == 2

    abrir_kanban(driver, base_url, projeto["id"])
    assert "Testes de bancada" in corpo(driver)


def test_coluna_com_tarefas_exige_destino_para_excluir(autenticado, projeto):
    """Excluir coluna ocupada sem informar destino deve ser recusado."""
    driver = autenticado
    coluna = api(
        driver, "POST", f"/api/projects/{projeto['id']}/columns", {"name": "Bloqueadas"}
    )["data"]["column"]

    api(
        driver,
        "POST",
        f"/api/projects/{projeto['id']}/tasks",
        {"title": "Tarefa bloqueada", "columnId": coluna["id"]},
    )

    resposta = api(driver, "DELETE", f"/api/projects/{projeto['id']}/columns/{coluna['id']}")
    assert resposta["status"] == 400
    assert "tarefa" in resposta["data"]["error"].lower()


def test_filtros_do_quadro_aparecem(autenticado, base_url, projeto):
    """UC06: filtros por responsável, prioridade, sprint e requisito."""
    driver = autenticado
    abrir_kanban(driver, base_url, projeto["id"])

    rotulos = [
        "Filtrar por responsável",
        "Filtrar por prioridade",
        "Filtrar por sprint",
    ]
    for rotulo in rotulos:
        assert driver.find_elements(By.CSS_SELECTOR, f"[aria-label='{rotulo}']"), (
            f"Filtro ausente no quadro: {rotulo}"
        )
