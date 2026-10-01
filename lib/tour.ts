import type { DemoChatSegment } from "./tour-chat-script"

/**
 * Roteiro do tour guiado da primeira sessão.
 *
 * Duas partes: primeiro a criação de um projeto com IA (a conversa é roteirizada e
 * reproduzida na tela de chat real), depois um passeio pelos módulos do projeto criado.
 *
 * Cada passo aponta para um elemento marcado com `data-tour="<alvo>"`. Quando o alvo não
 * existe na tela, o passo é exibido centralizado — assim o tour nunca trava.
 */

export interface TourStep {
  /** Valor do atributo data-tour do elemento a destacar. Ausente = card centralizado. */
  target?: string
  /** Rota do passo; `:id` é trocado pelo id do projeto de exemplo. */
  route: string
  title: string
  body: string
  /** Conquista registrada ao chegar no passo (gamificação). */
  achievement?: string
  /** Trecho da conversa roteirizada reproduzido no chat ao entrar no passo. */
  chat?: DemoChatSegment
  /** Ação executada ao avançar. */
  action?: "create-project"
  /** Texto do botão de avançar, quando não for "Próximo". */
  nextLabel?: string
  /**
   * "dock": card fixo no canto, sem escurecer a tela — usado enquanto a conversa da IA
   * acontece, para nada cobrir as mensagens.
   */
  placement?: "spotlight" | "dock"
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: "new-project-options",
    route: "/dashboard/projects/new",
    title: "Há duas formas de criar um projeto",
    body: "Com IA, o FlowBot conversa com você e levanta os requisitos a partir da sua ideia. Manualmente, você estrutura tudo por conta própria. Vamos ver a IA em ação.",
    achievement: "Caminhos conhecidos",
  },
  {
    route: "/dashboard",
    placement: "dock",
    chat: "ideia",
    title: "Você descreve a ideia",
    body: "Basta contar o que quer construir. O FlowBot identifica o que já está claro e pergunta só o que falta.",
  },
  {
    route: "/dashboard",
    placement: "dock",
    chat: "respostas",
    title: "Você responde e a IA gera os requisitos",
    body: "Com as respostas, o FlowBot organiza os requisitos funcionais e não funcionais do projeto.",
    achievement: "Conversa com a IA",
  },
  {
    target: "save-requirements",
    route: "/dashboard",
    action: "create-project",
    nextLabel: "Criar o projeto",
    title: "Um clique transforma a conversa em projeto",
    body: "Os requisitos gerados viram um projeto pronto para ser planejado. Clique em “Criar o projeto” para continuar.",
  },
  {
    route: "/dashboard/projects/:id",
    title: "Seu projeto de exemplo está pronto",
    body: "Este é o “Braço Robótico”, já com os requisitos da conversa e também tarefas e componentes para você explorar. Dá para editar ou excluir tudo depois.",
    achievement: "Primeiro projeto criado",
  },
  {
    target: "project-overview-stats",
    route: "/dashboard/projects/:id",
    title: "A visão geral mostra a saúde do projeto",
    body: "Tarefas concluídas, prazos vencidos, requisitos ainda sem tarefa e o custo estimado do hardware — tudo calculado a partir do que você cadastra.",
  },
  {
    target: "requirements-coverage",
    route: "/dashboard/projects/:id?step=requisitos",
    title: "Requisitos conectados à execução",
    body: "Aqui ficam os requisitos da conversa, numerados (RF01, RNF01…) e com histórico de alterações. As colunas Cobertura e Custo mostram quantas tarefas atendem cada requisito e quanto de hardware ele exige.",
    achievement: "Requisitos explorados",
  },
  {
    target: "project-nav-kanban",
    route: "/dashboard/projects/:id/kanban",
    title: "O Kanban organiza a execução",
    body: "Arraste os cards entre as colunas ou mude pelo seletor. Cada tarefa tem responsável, prazo, prioridade e o requisito que ela atende.",
    achievement: "Kanban descoberto",
  },
  {
    target: "project-nav-components",
    route: "/dashboard/projects/:id/components-costs",
    title: "Componentes viram custo automaticamente",
    body: "Cadastre as peças físicas e o FlowBot soma o custo do projeto. Associe cada componente a um requisito para saber o que realmente precisa ser comprado.",
    achievement: "Custos calculados",
  },
  {
    target: "project-nav-report",
    route: "/dashboard/projects/:id/report",
    title: "Relatórios prontos para entregar",
    body: "Um relatório consolidado com progresso por sprint e por módulo, rastreabilidade e custos — com exportação em PDF, CSV e Markdown.",
    achievement: "Relatório gerado",
  },
  {
    target: "flowbot-assistant",
    route: "/dashboard/projects/:id/report",
    title: "O FlowBot acompanha você",
    body: "Este robô conhece o seu projeto e guarda a conversa que o criou. Peça para criar requisitos, tarefas ou componentes: ele propõe e só grava depois que você confirmar.",
    achievement: "Assistente conhecido",
  },
  {
    route: "/dashboard/projects/:id",
    title: "Pronto para começar de verdade",
    body: "Você viu o caminho completo: ideia → requisitos → tarefas → custos → relatórios. Agora crie o seu projeto. Para rever este tour, use “Fazer tour guiado” no menu da sua conta.",
    achievement: "Tour concluído",
  },
]

export const TOUR_TOTAL = TOUR_STEPS.length

/**
 * Evento usado para reabrir o tour a partir do menu do usuário. Evita um provider só para
 * isso: o TourLauncher, montado no layout do painel, escuta e assume o controle.
 */
export const TOUR_START_EVENT = "flowbot:iniciar-tour"

export function startGuidedTour() {
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT))
}

/** Rota do passo; `null` quando depende do projeto e ele ainda não existe. */
export function resolveRoute(route: string, projectId: string | null): string | null {
  if (route.includes(":id")) return projectId ? route.replace(":id", projectId) : null
  return route
}

/** Conquistas acumuladas até o passo atual, para a barra de progresso gamificada. */
export function achievementsUntil(stepIndex: number): string[] {
  return TOUR_STEPS.slice(0, stepIndex + 1)
    .map((s) => s.achievement)
    .filter((a): a is string => Boolean(a))
}
