// Cargos e permissões de um projeto compartilhado, usados igualmente pelo servidor (que
// bloqueia) e pela interface (que esconde o que a pessoa não pode fazer).

export const MEMBER_ROLES = ["gestor", "funcionario", "estagiario", "visitante"] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]
/** O dono não é um membro: é quem criou o projeto (Project.userId). */
export type ProjectRole = "dono" | MemberRole

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (MEMBER_ROLES as readonly string[]).includes(value)
}

export const ROLE_LABELS: Record<ProjectRole, string> = {
  dono: "Dono",
  gestor: "Gestor",
  funcionario: "Funcionário",
  estagiario: "Estagiário",
  visitante: "Visitante",
}

export const ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  dono: "Criou o projeto. Pode tudo, inclusive excluí-lo.",
  gestor: "Coordena o projeto: edita tudo, convida pessoas e define os cargos.",
  funcionario: "Executa o trabalho: edita tarefas e componentes e vê o restante.",
  estagiario: "Aprende acompanhando: atua nas tarefas em que foi incluído.",
  visitante: "Só acompanha: vê o andamento, sem editar nada. É o cargo de quem aceita um convite.",
}

/** Áreas do projeto com permissão de edição própria. */
export type ProjectArea =
  | "projeto"
  | "requisitos"
  | "funcionalidades"
  | "kanban"
  | "sprints"
  | "componentes"
  | "recursos"
  | "diagramas"
  | "assistente"

const ALL_AREAS: ProjectArea[] = [
  "projeto",
  "requisitos",
  "funcionalidades",
  "kanban",
  "sprints",
  "componentes",
  "recursos",
  "diagramas",
  "assistente",
]

const EDITABLE: Record<ProjectRole, ProjectArea[]> = {
  dono: ALL_AREAS,
  gestor: ALL_AREAS,
  funcionario: ["kanban", "componentes", "assistente"],
  // Atuar só nas próprias tarefas exige ligar a conta da pessoa às tarefas; até lá, só leitura.
  estagiario: [],
  visitante: [],
}

export interface ProjectPermissions {
  role: ProjectRole
  /** Preços, custos, orçamento e a aba Recursos. */
  canSeeCosts: boolean
  canEdit: Record<ProjectArea, boolean>
  /** Convidar, remover pessoas e mudar cargos. */
  canManagePeople: boolean
  /** Excluir o projeto: só o dono. */
  canDelete: boolean
  /** Nenhuma edição em lugar nenhum. */
  readOnly: boolean
}

export function permissionsFor(role: ProjectRole, memberCanSeeCosts = false): ProjectPermissions {
  const editable = new Set(EDITABLE[role])
  const canEdit = Object.fromEntries(ALL_AREAS.map((area) => [area, editable.has(area)])) as Record<
    ProjectArea,
    boolean
  >
  return {
    role,
    canSeeCosts: role === "visitante" ? memberCanSeeCosts : true,
    canEdit,
    canManagePeople: role === "dono" || role === "gestor",
    canDelete: role === "dono",
    readOnly: editable.size === 0,
  }
}
