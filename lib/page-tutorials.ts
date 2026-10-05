// Tutoriais por página: cada tela explica para que serve e onde fica cada coisa. A central
// de tutoriais reúne estes roteiros, o tour para iniciantes e o tutorial completo (avançado).
// Os passos apontam para elementos marcados com data-tour; sem o elemento, o card fica
// centralizado e o tutorial segue normalmente.

export interface PageTutorialStep {
  target?: string
  title: string
  body: string
}

export interface PageTutorial {
  key: string
  title: string
  summary: string
  /** "geral": fora de um projeto; "projeto": precisa de um projeto aberto. */
  scope: "geral" | "projeto"
  path: (projectId: string | null) => string
  steps: PageTutorialStep[]
  /**
   * Data (AAAA-MM-DD) em que a tela entrou no FlowBot. Quem já usava a plataforma antes
   * dessa data recebe o aviso de novidade com o tutorial (components/tutorials/whats-new.tsx).
   */
  since?: string
}

export const PAGE_TUTORIALS: PageTutorial[] = [
  {
    key: "inicio",
    title: "Início: criar com a IA",
    summary: "Como descrever uma ideia e transformá-la em requisitos.",
    scope: "geral",
    path: () => "/dashboard",
    steps: [
      {
        title: "Aqui o projeto começa por uma conversa",
        body: "Descreva o que você quer construir. O FlowBot pergunta só o que falta e, no fim, organiza os requisitos funcionais e não funcionais.",
      },
      {
        target: "home-suggestions",
        title: "Sem ideia? Use um ponto de partida",
        body: "As sugestões preenchem o pedido com um tipo de projeto comum. Dá para editar antes de enviar.",
      },
      {
        target: "home-chat-input",
        title: "Escreva a sua ideia",
        body: "Enter envia; Shift+Enter quebra a linha. Quanto mais contexto (sensores, comunicação, limites de custo), menos perguntas a IA precisa fazer.",
      },
      {
        target: "home-steps",
        title: "As etapas da criação",
        body: "Requisitos, funcionalidades, componentes e custos. A trilha mostra em que etapa você está; ao finalizar, o projeto fica pronto para planejar.",
      },
    ],
  },
  {
    key: "projetos",
    title: "Lista de projetos",
    summary: "Onde ficam todos os seus projetos.",
    scope: "geral",
    path: () => "/dashboard/projects",
    steps: [
      {
        target: "projects-list",
        title: "Seus projetos",
        body: "Cada card abre a visão geral do projeto. O projeto de exemplo do tour também aparece aqui.",
      },
      {
        target: "projects-new",
        title: "Novo projeto",
        body: "Crie com a IA (conversando) ou manualmente (preenchendo cada etapa).",
      },
    ],
  },
  {
    key: "visao-geral",
    title: "Visão geral do projeto",
    summary: "A saúde do projeto em um só lugar.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}`,
    steps: [
      {
        target: "project-shortcuts",
        title: "Atalhos para cada módulo",
        body: "Kanban, sprints, relatórios e a estrutura do projeto (funcionalidades, componentes, recursos, requisitos e diagramas). O menu à esquerda leva aos mesmos lugares.",
      },
      {
        target: "project-overview-stats",
        title: "Indicadores calculados sozinhos",
        body: "Progresso, tarefas atrasadas, requisitos sem tarefa e custo estimado: tudo vem do que você cadastra nos módulos.",
      },
      {
        target: "flowbot-assistant",
        title: "O assistente do projeto",
        body: "O robô conhece este projeto. Peça para criar requisitos, tarefas ou componentes: ele propõe as mudanças e só grava depois da sua confirmação.",
      },
    ],
  },
  {
    key: "requisitos",
    title: "Requisitos",
    summary: "Cadastro, rastreabilidade e histórico dos requisitos.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/requirements`,
    steps: [
      {
        target: "requirements-coverage",
        title: "Requisitos numerados e rastreáveis",
        body: "Cada requisito recebe um código (RF01, RNF01…). Cobertura mostra quantas tarefas o atendem; Custo, quanto de componentes e recursos ele exige. As versões anteriores ficam no histórico.",
      },
      {
        target: "requirements-add",
        title: "Adicionar um requisito",
        body: "Informe descrição, categoria (funcional ou não funcional), prioridade e nível (sistema, subsistema ou componente).",
      },
    ],
  },
  {
    key: "funcionalidades",
    title: "Funcionalidades",
    summary: "Os módulos do projeto e o requisito que cada um atende.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/features`,
    steps: [
      {
        title: "Funcionalidades são os módulos do projeto",
        body: "Agrupam tarefas e aparecem no relatório como progresso por módulo. Ligue cada uma ao requisito que ela atende.",
      },
      {
        target: "features-add",
        title: "Adicionar uma funcionalidade",
        body: "Dê um nome, uma descrição curta e o status: planejada, em desenvolvimento ou concluída.",
      },
    ],
  },
  {
    key: "kanban",
    title: "Kanban",
    summary: "Tarefas, colunas e movimentação.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/kanban`,
    steps: [
      {
        target: "kanban-toolbar",
        title: "Criar tarefas e ajustar o quadro",
        body: "Nova tarefa abre o formulário completo (responsável, prazo, prioridade, requisito). Em Colunas você renomeia, reordena e define limites de trabalho em andamento.",
      },
      {
        target: "kanban-filters",
        title: "Filtrar o quadro",
        body: "Veja só as tarefas de um responsável, de uma prioridade, de uma sprint ou de um requisito.",
      },
      {
        title: "Mover tarefas",
        body: "Arraste os cards entre as colunas ou use o seletor dentro do card. Pelo teclado, Enter ou Espaço abrem a tarefa. Cada movimento fica registrado no histórico da tarefa.",
      },
    ],
  },
  {
    key: "sprints",
    title: "Sprints",
    summary: "Planejamento em períodos curtos.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/sprints`,
    steps: [
      {
        target: "sprints-new",
        title: "Planejar uma sprint",
        body: "Defina período, objetivo e as tarefas que entram nela. O progresso da sprint é calculado pelas tarefas concluídas.",
      },
    ],
  },
  {
    key: "componentes",
    title: "Componentes",
    summary: "Peças do produto, de hardware ou software.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/components-costs`,
    steps: [
      {
        title: "O que vai dentro do produto",
        body: "Sensores, placas, atuadores e também licenças ou bibliotecas pagas. Marque cada componente como hardware ou software e ligue-o a um requisito.",
      },
      {
        target: "components-cost",
        title: "Custo somado automaticamente",
        body: "Quantidade × preço unitário de cada componente. O total entra no orçamento do projeto, junto com os recursos.",
      },
    ],
  },
  {
    key: "recursos",
    title: "Recursos",
    summary: "Pessoas, equipamentos e serviços usados no projeto.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/resources`,
    steps: [
      {
        target: "resources-budget",
        title: "O orçamento completo",
        body: "Componentes mais recursos. Desembolso necessário é o que precisa ser comprado; recursos já disponíveis entram como custo de uso.",
      },
      {
        target: "resources-add",
        title: "Adicionar um recurso",
        body: "Escolha o tipo, se a organização já tem ou precisa adquirir e a cobrança: por hora (pessoas), por mês (serviços) ou valor único (equipamentos).",
      },
    ],
  },
  {
    key: "diagramas",
    title: "Diagramas",
    summary: "C4, modelo relacional e UML gerados do projeto.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/diagrams`,
    steps: [
      {
        target: "diagrams-new",
        title: "Gerar um diagrama",
        body: "Rastreabilidade e cronograma saem direto dos dados. C4, ER e UML são escritos pela IA a partir dos requisitos; use as instruções para dar foco (ex.: “detalhe o firmware”).",
      },
      {
        target: "diagrams-list",
        title: "Diagramas salvos",
        body: "Cada diagrama pode ser gerado de novo, editado em código Mermaid e exportado em SVG ou PNG.",
      },
    ],
  },
  {
    key: "relatorios",
    title: "Relatórios",
    summary: "Progresso, rastreabilidade e custos para entregar.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/report`,
    steps: [
      {
        target: "report-filters",
        title: "Escolha o recorte",
        body: "Tipo de relatório, período e filtros por sprint, responsável e funcionalidade. Clique em Gerar relatório para aplicar.",
      },
      {
        target: "report-exports",
        title: "Exporte para entregar",
        body: "PDF em formato de documento, CSV de cada tabela para planilhas e Markdown para repositórios.",
      },
    ],
  },
  {
    key: "minhas-ias",
    title: "Minhas IAs",
    summary: "Conectar as IAs que você já paga e o Claude Code ao FlowBot.",
    scope: "geral",
    path: () => "/dashboard/minhas-ias",
    since: "2026-10-05",
    steps: [
      {
        target: "aikeys-assistant",
        title: "Quem responde no assistente",
        body: "Escolha entre a IA gratuita do FlowBot e uma IA sua. Com a sua chave, o assistente lê mais do projeto e monta pacotes maiores de uma vez.",
      },
      {
        target: "aikeys-connect",
        title: "Conecte uma IA",
        body: "OpenAI (ChatGPT), Anthropic (Claude), Google Gemini, Groq ou OpenRouter. Cole a chave de API, busque os modelos e o FlowBot testa antes de salvar. A chave fica criptografada.",
      },
      {
        target: "aikeys-bridge",
        title: "Ponte com o Claude Code",
        body: "Gere um token e rode o comando no terminal: o Claude Code lê as tarefas do projeto, desenvolve o software e devolve o andamento para o quadro.",
      },
    ],
  },
  {
    key: "compartilhamento",
    title: "Compartilhamento",
    summary: "Convidar pessoas e definir o cargo de cada uma.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/sharing`,
    since: "2026-10-04",
    steps: [
      {
        target: "sharing-invite",
        title: "Convide por e-mail ou link",
        body: "Quem aceita entra como visitante, só acompanhando. O link vale 7 dias e pode ser trocado ou desativado.",
      },
      {
        target: "sharing-people",
        title: "Pessoas e cargos",
        body: "Gestor, funcionário, estagiário ou visitante. Custos e recursos ficam ocultos para visitante e estagiário, a menos que você libere.",
      },
      {
        target: "sharing-roles",
        title: "O que cada cargo pode fazer",
        body: "As permissões valem no servidor: um visitante não altera nada, nem pela IA nem pelo Claude Code.",
      },
    ],
  },
  {
    key: "desenvolvimento",
    title: "Desenvolvimento",
    summary: "O que o Claude Code fez e relatou no projeto.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/development`,
    since: "2026-10-05",
    steps: [
      {
        target: "dev-notes",
        title: "O andamento do desenvolvimento",
        body: "Progresso, tarefas concluídas, problemas e perguntas que o Claude Code registra ao desenvolver. Filtre por tipo e abra o link do PR ou commit.",
      },
      {
        title: "As IAs acompanham daqui",
        body: "O assistente e o conselho de IAs leem esse andamento para sugerir a continuidade: tarefas para os problemas, respostas às dúvidas e os próximos passos.",
      },
    ],
  },
  {
    key: "documentacao",
    title: "Documentação",
    summary: "Documentos de engenharia gerados a partir do projeto, nas normas ISO/IEC/IEEE.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/docs`,
    since: "2026-10-05",
    steps: [
      {
        target: "docs-settings",
        title: "Diretrizes da documentação",
        body: "Diga se é uma entrega acadêmica (instituição, curso, autores, orientador) e anexe o modelo de referência da instituição ou a rubrica: a IA segue a estrutura dele.",
      },
      {
        target: "docs-list",
        title: "Os documentos do projeto",
        body: "Visão, requisitos (SRS), casos de uso, arquitetura, plano de projeto, plano de testes, rastreabilidade e manual do usuário, cada um na estrutura da sua norma.",
      },
      {
        title: "Dados, diagramas e texto",
        body: "As tabelas saem direto dos dados e nunca ficam desatualizadas; os diagramas vêm da aba Diagramas; o texto é escrito pela IA e pode ser editado à mão. Depois é só exportar em PDF ou Markdown.",
      },
    ],
  },
  {
    key: "conselho",
    title: "Conselho de IAs",
    summary: "IAs com cargos discutem o projeto e propõem os próximos passos.",
    scope: "projeto",
    path: (id) => `/dashboard/projects/${id}/council`,
    since: "2026-10-05",
    steps: [
      {
        target: "council-members",
        title: "Monte o conselho",
        body: "Cada membro é uma IA com um cargo (gerente, analista de sprints, revisor de requisitos...). Use a IA gratuita ou as suas IAs de Minhas IAs.",
      },
      {
        target: "council-new-meeting",
        title: "Abra uma reunião",
        body: "Escolha um tema e as rodadas. Cada IA fala na sua vez, vendo o que as outras disseram, e você acompanha ao vivo.",
      },
      {
        target: "council-meetings",
        title: "A ata e as alterações",
        body: "O gerente escreve a ata (decisões, riscos e próximos passos) e propõe alterações no projeto, que só entram depois da sua confirmação.",
      },
    ],
  },
]

/** Tutoriais com aviso de "Novo" na central nos primeiros dias depois de lançados. */
export const NEW_TUTORIAL_DAYS = 30

export function isNewTutorial(tutorial: PageTutorial, now = Date.now()): boolean {
  if (!tutorial.since) return false
  return now - new Date(`${tutorial.since}T00:00:00`).getTime() < NEW_TUTORIAL_DAYS * 24 * 60 * 60 * 1000
}

/** Ordem do tutorial completo (avançado): todas as telas de um projeto, uma após a outra. */
export const ADVANCED_TUTORIAL = [
  "visao-geral",
  "requisitos",
  "funcionalidades",
  "kanban",
  "sprints",
  "componentes",
  "recursos",
  "diagramas",
  "documentacao",
  "relatorios",
  "desenvolvimento",
  "conselho",
  "compartilhamento",
]

export function getPageTutorial(key: string): PageTutorial | undefined {
  return PAGE_TUTORIALS.find((t) => t.key === key)
}

/** Identifica o tutorial da tela atual a partir do caminho e da query. */
export function tutorialForLocation(pathname: string, search: string): { key: string; projectId: string | null } | null {
  if (pathname === "/dashboard") return { key: "inicio", projectId: null }
  if (pathname === "/dashboard/projects") return { key: "projetos", projectId: null }
  if (pathname === "/dashboard/minhas-ias") return { key: "minhas-ias", projectId: null }

  const match = pathname.match(/^\/dashboard\/projects\/([^/]+)(?:\/([^/]+))?$/)
  if (!match || match[1] === "new") return null
  const [, projectId, section] = match
  const bySection: Record<string, string> = {
    kanban: "kanban",
    sprints: "sprints",
    report: "relatorios",
    features: "funcionalidades",
    "components-costs": "componentes",
    resources: "recursos",
    requirements: "requisitos",
    diagrams: "diagramas",
    docs: "documentacao",
    development: "desenvolvimento",
    council: "conselho",
    sharing: "compartilhamento",
  }
  if (section) return bySection[section] ? { key: bySection[section], projectId } : null
  // Com ?step= a tela é o assistente de criação, que não tem tutorial próprio.
  return new URLSearchParams(search).get("step") ? null : { key: "visao-geral", projectId }
}

/* ---- ponte entre a central de tutoriais e o executor (montado no layout) ---- */

export const TUTORIAL_START_EVENT = "flowbot:tutorial-iniciar"
export const HELP_CENTER_EVENT = "flowbot:central-tutoriais"

export interface TutorialRequest {
  keys: string[]
  projectId: string | null
}

export function startTutorials(request: TutorialRequest) {
  window.dispatchEvent(new CustomEvent<TutorialRequest>(TUTORIAL_START_EVENT, { detail: request }))
}

export function openHelpCenter() {
  window.dispatchEvent(new CustomEvent(HELP_CENTER_EVENT))
}
