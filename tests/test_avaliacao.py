"""Avaliação de usabilidade dentro do FlowBot (RNF01) e central de tutoriais."""

import pytest

from conftest import api

SUS_FAVORAVEL = [5, 1, 5, 2, 4, 1, 5, 1, 4, 2]  # nota esperada: 90


@pytest.fixture
def avaliacao(autenticado):
    """Avaliação nova criada pela conta admin de teste; excluída ao fim do teste."""
    driver = autenticado
    criada = api(driver, "POST", "/api/admin/studies", {"title": "[teste-e2e] Avaliação"})
    assert criada["status"] == 201, criada
    study = criada["data"]["study"]
    yield study
    api(driver, "DELETE", f"/api/admin/studies/{study['id']}")


def test_aceite_exige_termo(autenticado, avaliacao):
    driver = autenticado
    sem_aceite = api(driver, "POST", "/api/studies/join", {"code": avaliacao["inviteCode"]})
    assert sem_aceite["status"] == 400

    convite_invalido = api(driver, "POST", "/api/studies/join", {"code": "nao-existe", "consent": True})
    assert convite_invalido["status"] == 404


def test_participacao_completa_calcula_sus(autenticado, avaliacao):
    driver = autenticado
    aceite = api(driver, "POST", "/api/studies/join", {"code": avaliacao["inviteCode"], "consent": True})
    assert aceite["status"] == 201, aceite
    tarefas = aceite["data"]["participation"]["tasks"]
    assert len(tarefas) == 7

    marcada = api(driver, "POST", "/api/studies/me/tasks", {"taskKey": "sprint", "done": True})
    sprint = next(t for t in marcada["data"]["participation"]["tasks"] if t["key"] == "sprint")
    assert sprint["completedAt"] is not None

    incompleto = api(driver, "POST", "/api/studies/me/answers", {"sus": SUS_FAVORAVEL[:9]})
    assert incompleto["status"] == 400

    enviado = api(driver, "POST", "/api/studies/me/answers", {
        "sus": SUS_FAVORAVEL,
        "open": {"gostou": "A IA levantou os requisitos."},
        "profile": {"experiencia": "Média"},
    })
    assert enviado["status"] == 200, enviado
    assert api(driver, "POST", "/api/studies/me/answers", {"sus": SUS_FAVORAVEL})["status"] == 409

    resultados = api(driver, "GET", f"/api/admin/studies/{avaliacao['id']}")["data"]["results"]
    assert resultados["joined"] == 1
    assert resultados["submitted"] == 1
    assert resultados["sus"]["mean"] == 90
    assert resultados["participants"][0]["label"] == "P01"
    assert resultados["participants"][0]["open"]["gostou"] == "A IA levantou os requisitos."


def test_avaliacao_encerrada_nao_aceita_participantes(autenticado, avaliacao):
    driver = autenticado
    api(driver, "PATCH", f"/api/admin/studies/{avaliacao['id']}", {"status": "encerrada"})
    resposta = api(driver, "POST", "/api/studies/join", {"code": avaliacao["inviteCode"], "consent": True})
    assert resposta["status"] == 409


def test_progresso_dos_tutoriais(autenticado):
    driver = autenticado
    assert api(driver, "PATCH", "/api/user/tutorials", {"key": "nao-existe"})["status"] == 400

    marcado = api(driver, "PATCH", "/api/user/tutorials", {"key": "kanban"})
    assert "kanban" in marcado["data"]["progress"]

    zerado = api(driver, "PATCH", "/api/user/tutorials", {"reset": True})
    assert zerado["data"]["progress"] == {}
