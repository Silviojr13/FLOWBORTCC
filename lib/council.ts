/**
 * Conselho de IAs: cargos, limites e os tipos que a tela e o servidor compartilham.
 * Cada membro é uma IA com um cargo; numa reunião, cada um fala na sua vez, vendo o que os
 * outros disseram, e o relator fecha com a ata e as ações propostas.
 */

export const COUNCIL_ROLES = [
  "gerente",
  "analista_sprints",
  "analista_recursos",
  "revisor_requisitos",
  "qualidade",
  "arquiteto",
  "personalizado",
] as const

export type CouncilRole = (typeof COUNCIL_ROLES)[number]

export const COUNCIL_ROLE_INFO: Record<CouncilRole, { label: string; focus: string }> = {
  gerente: {
    label: "Gerente de projeto",
    focus: "prioridades, prazos, riscos de cronograma e decisões; conduz a reunião e é o relator da ata",
  },
  analista_sprints: {
    label: "Analista de sprints",
    focus: "andamento das sprints, tarefas atrasadas ou sem responsável, capacidade da equipe e distribuição do trabalho",
  },
  analista_recursos: {
    label: "Analista de custos e recursos",
    focus: "orçamento, componentes, recursos que faltam ou sobram e custo das decisões",
  },
  revisor_requisitos: {
    label: "Revisor de requisitos",
    focus: "requisitos sem tarefa, ambíguos ou que faltam, rastreabilidade e critérios de aceite",
  },
  qualidade: {
    label: "Qualidade e testes",
    focus: "testes, riscos técnicos, critérios de pronto e o que pode quebrar na entrega",
  },
  arquiteto: {
    label: "Arquiteto",
    focus: "arquitetura de hardware e software, integração entre módulos e dívida técnica",
  },
  personalizado: {
    label: "Cargo personalizado",
    focus: "o que estiver descrito nas instruções do membro",
  },
}

export function isCouncilRole(value: unknown): value is CouncilRole {
  return typeof value === "string" && (COUNCIL_ROLES as readonly string[]).includes(value)
}

export const MAX_COUNCIL_MEMBERS = 5
export const MIN_COUNCIL_MEMBERS = 2
export const MAX_COUNCIL_ROUNDS = 3

/** Membro como a tela edita e como a reunião guarda (keyId null = IA gratuita do FlowBot). */
export interface CouncilMemberInput {
  name: string
  role: CouncilRole
  instructions: string | null
  keyId: string | null
}

export interface CouncilMeetingSummary {
  id: string
  topic: string
  status: "running" | "done"
  createdAt: string
  runner: string | null
  isMine: boolean
}

export interface CouncilMessageView {
  turn: number
  round: number
  speaker: string
  role: string
  model: string
  content: string
}

export interface CouncilMeetingView extends CouncilMeetingSummary {
  rounds: number
  members: (CouncilMemberInput & { label: string })[]
  messages: CouncilMessageView[]
  summary: string | null
  appliedSummary: string | null
  /** Próxima fala (0, 1, 2...) e o total: quando turn === total, falta só a ata. */
  nextTurn: number
  totalTurns: number
}

/** Temas prontos para começar uma reunião. */
export const COUNCIL_TOPICS = [
  "Analisar a sprint atual e propor ajustes",
  "Revisar os riscos e os recursos do projeto",
  "Planejar a próxima sprint",
  "Encontrar requisitos sem cobertura e o que falta",
]
