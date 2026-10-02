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


def test_convite_por_email(autenticado, avaliacao, credentials):
    """O admin convida pelo e-mail exato; o convite aparece para a conta sem link."""
    driver = autenticado
    email, _ = credentials
    base = f"/api/admin/studies/{avaliacao['id']}/invitations"

    assert api(driver, "POST", base, {"email": "nao-e-email"})["status"] == 400

    convite = api(driver, "POST", base, {"email": email.upper()})
    assert convite["status"] == 201, convite
    assert convite["data"]["invitation"]["email"] == email.lower()
    assert convite["data"]["invitation"]["hasAccount"] is True
    assert convite["data"]["invitation"]["status"] == "pendente"

    sem_conta = api(driver, "POST", base, {"email": "ninguem-cadastrado@flowbot.test"})
    assert sem_conta["data"]["invitation"]["hasAccount"] is False

    me = api(driver, "GET", "/api/studies/me")["data"]
    assert me["invite"]["source"] == "email"
    assert me["invite"]["code"] == avaliacao["inviteCode"]

    # Recusar esconde o convite; convidar de novo reabre.
    api(driver, "POST", "/api/studies/decline", {"code": avaliacao["inviteCode"]})
    assert api(driver, "GET", "/api/studies/me")["data"]["invite"] is None
    api(driver, "POST", base, {"email": email})

    aceite = api(driver, "POST", "/api/studies/join", {"code": avaliacao["inviteCode"], "consent": True})
    assert aceite["status"] == 201
    convites = api(driver, "GET", base)["data"]["invitations"]
    assert next(c for c in convites if c["email"] == email.lower())["status"] == "aceito"

    # Cancelar só vale para convite ainda não aceito.
    pendente = next(c for c in convites if c["status"] == "pendente")
    assert api(driver, "DELETE", f"{base}/{pendente['id']}")["status"] == 200
