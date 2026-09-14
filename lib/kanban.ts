// Tipos e constantes do módulo Kanban (RF05–RF09), compartilhados entre API e UI.

export const TASK_PRIORITIES = ["Alta", "Média", "Baixa"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && (TASK_PRIORITIES as readonly string[]).includes(value)
}

// Ordem de exibição quando o usuário escolhe "ordenar por prioridade" (UC07 fluxo alternativo).
export const PRIORITY_RANK: Record<TaskPriority, number> = { Alta: 0, Média: 1, Baixa: 2 }

// Colunas padrão de um projeto novo (RF05). O usuário pode renomear, reordenar,
// adicionar e remover colunas depois.
export const DEFAULT_KANBAN_COLUMNS: { name: string; isDone: boolean }[] = [
  { name: "Backlog", isDone: false },
  { name: "Em Progresso", isDone: false },
  { name: "Em Revisão", isDone: false },
  { name: "Concluído", isDone: true },
]

export interface KanbanColumn {
  id: string
  name: string
  order: number
  isDone: boolean
  wipLimit: number | null
  projectId: string
}

export interface TaskRequirementRef {
  id: string
  code: string
  description: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  assignee: string | null
  dueDate: string | null
  order: number
  columnId: string
  projectId: string
  requirementId: string | null
  featureId: string | null
  sprintId: string | null
  createdAt: string
  updatedAt: string
  requirement: TaskRequirementRef | null
  feature: { id: string; name: string } | null
  sprint: { id: string; name: string } | null
}

export interface TaskHistoryEntry {
  id: string
  taskId: string
  fromColumn: string | null
  toColumn: string
  changedAt: string
}

export type SprintStatus = "Planejada" | "Em andamento" | "Concluída"

export interface Sprint {
  id: string
  name: string
  goal: string | null
  startDate: string
  endDate: string
  projectId: string
  tasksTotal: number
  tasksDone: number
  status: SprintStatus
}

// Início do dia de hoje em UTC, para comparar com prazos salvos como data pura.
export function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

// Tarefa atrasada (RF14): tem prazo, prazo já passou e não está numa coluna concluída.
export function isTaskOverdue(task: Pick<Task, "dueDate">, isDone: boolean): boolean {
  if (!task.dueDate || isDone) return false
  return new Date(task.dueDate).getTime() < startOfTodayUtc().getTime()
}

export function getSprintStatus(startDate: string | Date, endDate: string | Date): SprintStatus {
  const today = startOfTodayUtc().getTime()
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  if (today < start) return "Planejada"
  if (today > end) return "Concluída"
  return "Em andamento"
}

// Prazos e períodos são datas puras (sem hora); formata em UTC para não deslocar um dia.
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

export function sortTasksByPriority<T extends Pick<Task, "priority" | "dueDate" | "order">>(
  tasks: T[]
): T[] {
  return [...tasks].sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (byPriority !== 0) return byPriority
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
    if (aDue !== bDue) return aDue - bDue
    return a.order - b.order
  })
}
