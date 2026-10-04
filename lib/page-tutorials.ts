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
]

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
  "relatorios",
]

export function getPageTutorial(key: string): PageTutorial | undefined {
  return PAGE_TUTORIALS.find((t) => t.key === key)
}

/** Identifica o tutorial da tela atual a partir do caminho e da query. */
export function tutorialForLocation(pathname: string, search: string): { key: string; projectId: string | null } | null {
  if (pathname === "/dashboard") return { key: "inicio", projectId: null }
  if (pathname === "/dashboard/projects") return { key: "projetos", projectId: null }

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
