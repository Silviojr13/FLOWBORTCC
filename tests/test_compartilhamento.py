"""Compartilhamento de projetos com cargos (RF19–RF21).

O dono é a conta de teste da suíte (navegador). O visitante é uma segunda conta, usada por
uma sessão HTTP à parte; suas credenciais vêm de FLOWBOT_VISITOR_EMAIL e
FLOWBOT_VISITOR_PASSWORD. Sem elas, os testes são pulados.
"""

import http.cookiejar
import json
import os
import urllib.error
import urllib.parse
import urllib.request

import pytest
from selenium.webdriver.support.ui import WebDriverWait

from conftest import TIMEOUT, aguardar_carregamento, api, corpo


class SessaoHttp:
    """Sessão de uma segunda conta, sem navegador, para falar com a API como ela."""

    def __init__(self, base_url: str, email: str, senha: str):
        self.base_url = base_url
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        csrf = self.chamar("GET", "/api/auth/csrf")["data"]["csrfToken"]
        dados = urllib.parse.urlencode(
            {"csrfToken": csrf, "email": email, "password": senha, "json": "true"}
        ).encode()
        pedido = urllib.request.Request(
            f"{base_url}/api/auth/callback/credentials",
            data=dados,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            self.opener.open(pedido, timeout=120)
        except urllib.error.URLError:
            pass  # o redirecionamento pós-login pode apontar para outra origem; o cookie já veio
        assert self.chamar("GET", "/api/auth/session")["data"].get("user"), "Login do visitante falhou"

    def chamar(self, method: str, path: str, body: dict | None = None) -> dict:
        dados = json.dumps(body).encode() if body is not None else None
        pedido = urllib.request.Request(
            f"{self.base_url}{path}",
            data=dados,
            method=method,
            headers={"Content-Type": "application/json"} if dados else {},
        )
        try:
            with self.opener.open(pedido, timeout=180) as resposta:
                status, texto = resposta.status, resposta.read().decode()
        except urllib.error.HTTPError as erro:
            status, texto = erro.code, erro.read().decode()
        try:
            return {"status": status, "data": json.loads(texto)}
        except ValueError:
            return {"status": status, "data": texto}


@pytest.fixture(scope="session")
def visitante(base_url):
    email = os.environ.get("FLOWBOT_VISITOR_EMAIL")
    senha = os.environ.get("FLOWBOT_VISITOR_PASSWORD")
    if not email or not senha:
        pytest.skip("Defina FLOWBOT_VISITOR_EMAIL e FLOWBOT_VISITOR_PASSWORD para testar o compartilhamento.")
    sessao = SessaoHttp(base_url, email, senha)
    sessao.email = email
    return sessao


@pytest.fixture
def compartilhado(autenticado, projeto, visitante):
    """Projeto do dono com o visitante já dentro, pelo link de convite."""
    link = api(autenticado, "POST", f"/api/projects/{projeto['id']}/sharing/link")
    assert link["status"] == 201, link
    codigo = link["data"]["link"]["url"].rsplit("/", 1)[1]
    aceite = visitante.chamar("POST", f"/api/invitations/{codigo}", {"action": "aceitar"})
    assert aceite["status"] == 200, aceite
    return {**projeto, "codigo": codigo}


def test_sem_convite_o_projeto_nao_existe_para_outra_conta(projeto, visitante):
    """Quem não foi convidado recebe 404, sem saber que o projeto existe."""
    assert visitante.chamar("GET", f"/api/projects/{projeto['id']}")["status"] == 404


def test_quem_aceita_o_convite_entra_como_visitante(compartilhado, visitante):
    """RF19: aceitar o convite dá acesso só de leitura, com custos ocultos."""
    resposta = visitante.chamar("GET", f"/api/projects/{compartilhado['id']}")
    assert resposta["status"] == 200, resposta
    acesso = resposta["data"]["access"]
    assert acesso["role"] == "visitante"
    assert acesso["readOnly"] is True
    assert acesso["canSeeCosts"] is False

    lista = visitante.chamar("GET", "/api/projects")["data"]
    assert any(p["id"] == compartilhado["id"] for p in lista["shared"])


def test_visitante_nao_altera_nada(autenticado, compartilhado, visitante):
    """RF20: toda escrita do visitante é recusada pelo servidor."""
    base = f"/api/projects/{compartilhado['id']}"
    tarefa = api(autenticado, "POST", f"{base}/tasks", {"title": "Tarefa do dono"})
    assert tarefa["status"] == 201, tarefa
    tarefa_id = tarefa["data"]["task"]["id"]

    tentativas = [
        ("POST", f"{base}/tasks", {"title": "x"}),
        ("PATCH", f"{base}/tasks/{tarefa_id}", {"title": "x"}),
        ("DELETE", f"{base}/tasks/{tarefa_id}", None),
        ("POST", f"{base}/requirements", {"description": "x", "category": "Funcional", "priority": "Alta"}),
        ("POST", f"{base}/features", {"name": "x"}),
        ("POST", f"{base}/sprints", {"name": "x", "startDate": "2026-10-10", "endDate": "2026-10-20"}),
        ("POST", f"{base}/components", {"name": "x", "quantity": 1, "unitPrice": 1}),
        ("POST", f"{base}/columns", {"name": "x"}),
        ("POST", f"{base}/diagrams", {"type": "gantt"}),
        ("POST", f"{base}/sharing/link", None),
        ("POST", f"{base}/sharing/invitations", {"email": "alguem@flowbot.test"}),
        ("DELETE", base, None),
    ]
    for method, path, body in tentativas:
        resposta = visitante.chamar(method, path, body)
        assert resposta["status"] in (403, 404), f"{method} {path} deveria ser recusado: {resposta}"

    # A tarefa do dono continua intacta.
    kanban = visitante.chamar("GET", f"{base}/kanban")["data"]
    assert any(t["id"] == tarefa_id and t["title"] == "Tarefa do dono" for t in kanban["tasks"])


def test_custos_ficam_ocultos_ate_o_dono_liberar(autenticado, compartilhado, visitante):
    """RF21: preços, orçamento e recursos só aparecem se o dono liberar."""
    base = f"/api/projects/{compartilhado['id']}"
    api(autenticado, "POST", f"{base}/components", {"name": "Sensor", "quantity": 2, "unitPrice": 15})

    componentes = visitante.chamar("GET", f"{base}/components")["data"]
    assert componentes["totalCost"] is None
    assert all(c["unitPrice"] is None for c in componentes["components"])
    assert visitante.chamar("GET", f"{base}/resources")["status"] == 403
    relatorio = visitante.chamar("GET", f"{base}/report")["data"]["report"]
    assert relatorio["costsHidden"] is True and relatorio["summary"]["budgetTotal"] == 0
    assert visitante.chamar("GET", f"{base}/report?type=custos")["status"] == 403

    pessoas = api(autenticado, "GET", f"{base}/sharing")["data"]
    membro = next(m for m in pessoas["members"] if m["email"] == visitante.email)
    liberar = api(autenticado, "PATCH", f"{base}/sharing/members/{membro['id']}", {"canSeeCosts": True})
    assert liberar["status"] == 200, liberar

    componentes = visitante.chamar("GET", f"{base}/components")["data"]
    assert componentes["totalCost"] == 30
    assert visitante.chamar("GET", f"{base}/resources")["status"] == 200
    # Ver custos não dá permissão de editar.
    assert visitante.chamar("POST", f"{base}/resources", {"name": "x", "type": "outro"})["status"] == 403


def test_convite_por_email_so_vale_para_o_email_convidado(autenticado, projeto, visitante):
    """Convite por e-mail: renova em vez de duplicar e só a conta convidada aceita."""
    base = f"/api/projects/{projeto['id']}"
    convite = api(autenticado, "POST", f"{base}/sharing/invitations", {"email": "Outra.Pessoa@flowbot.test"})
    assert convite["status"] == 201, convite
    assert convite["data"]["invitation"]["email"] == "outra.pessoa@flowbot.test"
    assert api(autenticado, "POST", f"{base}/sharing/invitations", {"email": "outra.pessoa@flowbot.test"})["status"] == 200

    pendentes = api(autenticado, "GET", f"{base}/sharing")["data"]["invitations"]
    assert [i["email"] for i in pendentes] == ["outra.pessoa@flowbot.test"]

    # Pelo código, o visitante (outro e-mail) não consegue aceitar.
    codigo = None
    for convite_codigo in visitante.chamar("GET", "/api/invitations")["data"]["invitations"]:
        codigo = convite_codigo["code"]
    assert codigo is None, "O convite de outro e-mail não deveria aparecer para o visitante"


def test_remover_e_sair_do_projeto(autenticado, compartilhado, visitante):
    """O dono remove o visitante; o visitante também pode sair sozinho."""
    base = f"/api/projects/{compartilhado['id']}"
    membro = next(
        m for m in api(autenticado, "GET", f"{base}/sharing")["data"]["members"] if m["email"] == visitante.email
    )
    assert api(autenticado, "DELETE", f"{base}/sharing/members/{membro['id']}")["status"] == 200
    assert visitante.chamar("GET", base)["status"] == 404

    # Entra de novo pelo link e sai por conta própria.
    assert visitante.chamar("POST", f"/api/invitations/{compartilhado['codigo']}", {"action": "aceitar"})["status"] == 200
    eu = next(m for m in visitante.chamar("GET", f"{base}/sharing")["data"]["members"] if m["isYou"])
    assert visitante.chamar("DELETE", f"{base}/sharing/members/{eu['id']}")["status"] == 200
    assert visitante.chamar("GET", base)["status"] == 404


def test_aba_compartilhamento_mostra_o_visitante(autenticado, base_url, compartilhado, visitante):
    """A aba Compartilhamento do dono lista o visitante com o cargo."""
    driver = autenticado
    driver.get(f"{base_url}/dashboard/projects/{compartilhado['id']}/sharing")
    aguardar_carregamento(driver)
    WebDriverWait(driver, TIMEOUT).until(lambda d: visitante.email in corpo(d))
    texto = corpo(driver)
    assert "Visitante" in texto
    assert "Link de convite" in texto
