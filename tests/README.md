# Testes de integração (Selenium)

Suíte que exercita o FlowBot pela interface, cobrindo os quatro módulos e a integração
entre eles. São 29 testes distribuídos em cinco arquivos:

| Arquivo | Cobre |
|---|---|
| `test_autenticacao.py` | Login, credenciais inválidas e proteção de rotas (RNF05) |
| `test_requisitos.py` | Cadastro, numeração automática, histórico e nível (RF01–RF04, RNF04) |
| `test_kanban.py` | Colunas configuráveis, tarefas, movimentação, histórico e filtros (RF05–RF07, RF09) |
| `test_sprints_e_relatorios.py` | Planejamento e progresso de sprints (RF08, UC07, UC13) e relatórios com exportação (RF13, RF15) |
| `test_integracao_modulos.py` | Repercussão entre Requisitos, Kanban e Custos (Sprint 2) |

## Pré-requisitos

- Python 3.11+
- Google Chrome ou Microsoft Edge instalado (o Selenium Manager baixa o driver sozinho)
- A aplicação em execução (`npm run dev`) e uma conta de teste já cadastrada

```bash
pip install -r requirements-test.txt
```

## Como rodar

As credenciais vêm de variáveis de ambiente — nada fica no código:

```bash
FLOWBOT_BASE_URL=http://localhost:3000 FLOWBOT_TEST_EMAIL=... FLOWBOT_TEST_PASSWORD=... python -m pytest
```

No PowerShell:

```powershell
$env:FLOWBOT_BASE_URL="http://localhost:3000"; $env:FLOWBOT_TEST_EMAIL="..."; $env:FLOWBOT_TEST_PASSWORD="..."; python -m pytest
```

| Variável | Padrão | Observação |
|---|---|---|
| `FLOWBOT_BASE_URL` | `http://localhost:3000` | Pode apontar para o ambiente de homologação |
| `FLOWBOT_TEST_EMAIL` / `FLOWBOT_TEST_PASSWORD` | — | Sem elas, os testes que exigem login são **pulados**, não falham |
| `FLOWBOT_VISITOR_EMAIL` / `FLOWBOT_VISITOR_PASSWORD` | — | Segunda conta, que recebe o convite nos testes de compartilhamento; sem elas, esses testes são pulados |
| `FLOWBOT_BROWSER` | `chrome` | `edge` como alternativa; há fallback automático |
| `FLOWBOT_HEADLESS` | `1` | `0` para acompanhar a execução na tela |

## Como a suíte se comporta

- **Isolamento**: cada teste que precisa de dados cria um projeto próprio, com nome
  `[teste-e2e] <hash>`, e o remove ao final. Os projetos existentes não são tocados.
- **Preparação via API, verificação pela interface**: o preparo dos dados usa a API
  reaproveitando a sessão do navegador (rápido e estável); o que está sendo testado é
  verificado na tela ou na resposta da rota.
- **Esperas explícitas**: as telas montam antes de os dados chegarem, então a suíte espera
  os textos de carregamento desaparecerem (`aguardar_carregamento`) em vez de usar pausas
  fixas.

## Por que não roda no CI

A suíte depende de uma aplicação no ar e de um banco Turso com conta de teste. Executá-la
no GitHub Actions exigiria expor as credenciais do banco de produção e geraria dados a cada
push. O workflow de CI roda lint, verificação de tipos e build; a análise estática roda no
SonarCloud pela análise automática a cada push e Pull Request. Os testes de integração são
executados localmente e antes das entregas.
