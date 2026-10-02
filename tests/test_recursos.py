"""Recursos do projeto, componentes de hardware/software e filtros do relatório."""

from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, aguardar_carregamento, api, corpo


def criar_recurso(driver, projeto_id, **campos):
    resposta = api(driver, "POST", f"/api/projects/{projeto_id}/resources", campos)
    assert resposta["status"] == 201, resposta
    return resposta["data"]["resource"]


def test_recurso_calcula_custo_e_entra_no_orcamento(autenticado, projeto):
    """Pessoa por hora (já disponível) e software por mês (a adquirir) no orçamento."""
    driver = autenticado
    criar_recurso(
        driver, projeto["id"], name="Engenheira de firmware", type="pessoa",
        costModel="hora", unitCost=50, quantity=10,
    )
    criar_recurso(
        driver, projeto["id"], name="Licença de CAD", type="software",
        availability="adquirir", costModel="mes", unitCost=100, quantity=2,
    )
    api(
        driver, "POST", f"/api/projects/{projeto['id']}/components",
        {"name": "Biblioteca de visão", "quantity": 1, "unitPrice": 30, "domain": "Software"},
    )

    relatorio = api(driver, "GET", f"/api/projects/{projeto['id']}/report?type=custos")
    assert relatorio["status"] == 200
    orcamento = relatorio["data"]["report"]["budget"]

    assert orcamento["componentsSoftware"] == 30
    assert orcamento["resourcesAvailable"] == 500
    assert orcamento["toSpend"] == 230  # componente + recurso a adquirir
    assert orcamento["total"] == 730


def test_recurso_invalido_e_recusado(autenticado, projeto):
    driver = autenticado
    sem_nome = api(driver, "POST", f"/api/projects/{projeto['id']}/resources", {"type": "pessoa", "unitCost": 10})
    assert sem_nome["status"] == 400

    custo_negativo = api(
        driver, "POST", f"/api/projects/{projeto['id']}/resources",
        {"name": "Bancada", "type": "espaco", "unitCost": -5},
    )
    assert custo_negativo["status"] == 400


def test_recurso_pode_ser_editado_e_excluido(autenticado, projeto):
    driver = autenticado
    recurso = criar_recurso(
        driver, projeto["id"], name="Osciloscópio", type="equipamento", unitCost=900, quantity=1,
    )

    editado = api(
        driver, "PATCH", f"/api/projects/{projeto['id']}/resources/{recurso['id']}",
        {"availability": "adquirir", "unitCost": 1200},
    )
    assert editado["status"] == 200
    assert editado["data"]["resource"]["availability"] == "adquirir"
    assert editado["data"]["resource"]["unitCost"] == 1200

    excluido = api(driver, "DELETE", f"/api/projects/{projeto['id']}/resources/{recurso['id']}")
    assert excluido["status"] == 200
    lista = api(driver, "GET", f"/api/projects/{projeto['id']}/resources")
    assert lista["data"]["resources"] == []


def test_tela_de_recursos_lista_o_cadastrado(autenticado, base_url, projeto):
    driver = autenticado
    criar_recurso(driver, projeto["id"], name="Impressora 3D", type="equipamento", unitCost=2500)

    driver.get(f"{base_url}/dashboard/projects/{projeto['id']}/resources")
    WebDriverWait(driver, TIMEOUT).until(lambda d: "Impressora 3D" in corpo(d))
    aguardar_carregamento(driver)
    assert "Orçamento total" in corpo(driver)


def test_relatorio_filtra_por_responsavel(autenticado, projeto):
    driver = autenticado
    for titulo, responsavel in [("Soldar placa", "Ana"), ("Escrever firmware", "Bruno")]:
        resposta = api(
            driver, "POST", f"/api/projects/{projeto['id']}/tasks",
            {"title": titulo, "assignee": responsavel},
        )
        assert resposta["status"] == 201, resposta

    relatorio = api(driver, "GET", f"/api/projects/{projeto['id']}/report?type=progresso&assignee=Ana")
    assert relatorio["status"] == 200
    dados = relatorio["data"]["report"]

    assert [t["title"] for t in dados["tasks"]] == ["Soldar placa"]
    assert dados["filters"]["assignee"] == "Ana"
    assert sorted(dados["filterOptions"]["assignees"]) == ["Ana", "Bruno"]
