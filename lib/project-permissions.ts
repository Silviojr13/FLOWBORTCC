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
  estagiario: "Aprende fazendo: edita e move as tarefas em que é responsável ou participante e vê o restante.",
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
  // Só nas próprias tarefas: ver ownTasksOnly.
  estagiario: ["kanban"],
  visitante: [],
}

/** Cargos que só veem custos, preços e recursos quando quem gerencia libera. */
export const COSTS_ON_REQUEST: ProjectRole[] = ["estagiario", "visitante"]

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
  /**
   * No Kanban, só as tarefas em que a pessoa é responsável principal ou participante (pelo
   * nome da conta); não cria nem exclui tarefas nem mexe nas colunas.
   */
  ownTasksOnly: boolean
  /** Nome de quem está vendo, para reconhecer as próprias tarefas. */
  viewerName?: string | null
}

export function permissionsFor(role: ProjectRole, memberCanSeeCosts = false): ProjectPermissions {
  const editable = new Set(EDITABLE[role])
  const canEdit = Object.fromEntries(ALL_AREAS.map((area) => [area, editable.has(area)])) as Record<
    ProjectArea,
    boolean
  >
  return {
    role,
    // Visitante e estagiário só veem custos se quem gerencia liberar.
    canSeeCosts: COSTS_ON_REQUEST.includes(role) ? memberCanSeeCosts : true,
    canEdit,
    canManagePeople: role === "dono" || role === "gestor",
    canDelete: role === "dono",
    readOnly: editable.size === 0,
    ownTasksOnly: role === "estagiario",
  }
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")

/** A pessoa é a responsável principal ou participante da tarefa? */
export function isOwnTask(
  viewerName: string | null | undefined,
  task: { assignee: string | null; participants?: ({ name: string } | string)[] }
): boolean {
  if (!viewerName?.trim()) return false
  const me = normalizeName(viewerName)
  const people = [task.assignee, ...(task.participants ?? []).map((p) => (typeof p === "string" ? p : p.name))]
  return people.some((name) => !!name && normalizeName(name) === me)
}

/** Pode alterar esta tarefa (editar, mover de coluna)? */
export function canEditTask(
  permissions: ProjectPermissions,
  task: { assignee: string | null; participants?: ({ name: string } | string)[] }
): boolean {
  if (!permissions.canEdit.kanban) return false
  return !permissions.ownTasksOnly || isOwnTask(permissions.viewerName, task)
}

/** Cria e exclui tarefas e mexe nas colunas: o Kanban inteiro, não só as próprias tarefas. */
export function canManageBoard(permissions: ProjectPermissions): boolean {
  return permissions.canEdit.kanban && !permissions.ownTasksOnly
}
