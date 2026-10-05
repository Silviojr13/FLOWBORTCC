import { tursoDb } from "./turso-db"
import { getProjectAccess, type ProjectAccess } from "./project-access"
import { buildProjectContext } from "./project-context"
import { emitProjectEvent } from "./project-events"
import { ensureKanbanColumns } from "./kanban-server"
import { formatDate, type TaskPriority } from "./kanban"
import { ROLE_LABELS, canEditTask, canManageBoard } from "./project-permissions"
import { DEV_NOTE_KINDS, DEV_NOTE_LABELS, isDevNoteKind } from "./dev-notes"

/**
 * Ponte com o Claude: o que o Claude Code pode fazer num projeto pelo servidor MCP
 * (/api/mcp), sempre em nome da dona do token e com as permissões do cargo dela.
 *
 * As ferramentas devolvem texto pronto para o modelo ler. Erros de uso viram BridgeError,
 * que o servidor MCP devolve como resultado com isError (o modelo lê e corrige o pedido).
 */

export class BridgeError extends Error {}

export interface BridgeUser {
  id: string
  name: string | null
}

/** Sem acento, minúsculo e com espaços simples: "Em Revisão" casa com "em revisao". */
function norm(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

async function accessOrFail(projectId: unknown, user: BridgeUser): Promise<ProjectAccess> {
  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new BridgeError("Informe projeto_id (use listar_projetos para ver os ids).")
  }
  const access = await getProjectAccess(projectId.trim(), user.id)
  if (!access) throw new BridgeError("Projeto não encontrado ou sem acesso para esta conta.")
  return { ...access, viewerName: user.name }
}

const taskSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  assignee: true,
  dueDate: true,
  columnId: true,
  requirementId: true,
  column: { select: { name: true, isDone: true } },
  requirement: { select: { code: true } },
  feature: { select: { name: true } },
  sprint: { select: { name: true } },
  participants: { select: { name: true }, orderBy: { order: "asc" as const } },
} as const

/** Tarefa pelo id ou pelo título exato (sem diferenciar acento e maiúsculas). */
async function findTask(projectId: string, ref: unknown) {
  if (typeof ref !== "string" || !ref.trim()) throw new BridgeError("Informe a tarefa (id ou título exato).")
  const byId = await tursoDb.task.findFirst({ where: { id: ref.trim(), projectId }, select: taskSelect })
  if (byId) return byId
  const wanted = norm(ref)
  const all = await tursoDb.task.findMany({ where: { projectId }, select: taskSelect })
  const matches = all.filter((t) => norm(t.title) === wanted)
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    throw new BridgeError(`Há ${matches.length} tarefas com esse título. Use o id: ${matches.map((t) => t.id).join(", ")}.`)
  }
  throw new BridgeError(`Tarefa "${clip(ref, 80)}" não encontrada. Use listar_tarefas para ver os ids e títulos.`)
}

/** Coluna pelo nome; "concluido", "feito" ou "done" apontam para a coluna de concluídas. */
async function findColumn(projectId: string, name: unknown) {
  const columns = await ensureKanbanColumns(projectId)
  if (typeof name !== "string" || !name.trim()) return { column: null, columns }
  const wanted = norm(name)
  const column =
    columns.find((c) => norm(c.name) === wanted) ??
    columns.find((c) => norm(c.name).startsWith(wanted)) ??
    (/^(concluid|feito|done|pronto)/.test(wanted) ? columns.find((c) => c.isDone) : undefined)
  if (!column) {
    throw new BridgeError(`Coluna "${clip(name, 40)}" não existe. Colunas do quadro: ${columns.map((c) => c.name).join(", ")}.`)
  }
  return { column, columns }
}

function permissionsLine(access: ProjectAccess): string {
  const what = access.readOnly
    ? "só leitura (não cria, não move tarefas nem registra andamento)"
    : access.ownTasksOnly
      ? "move e registra andamento só nas tarefas em que a conta é responsável ou participante; não cria tarefas"
      : access.canEdit.kanban
        ? "cria e move tarefas e registra andamento"
        : "só leitura no quadro"
  return `Cargo desta conta no projeto: ${ROLE_LABELS[access.role]} — ${what}.`
}

/* ---------------------------------------------------------------- ferramentas */

export async function listProjects(user: BridgeUser): Promise<string> {
  const [owned, memberships] = await Promise.all([
    tursoDb.project.findMany({
      where: { userId: user.id, isTutorial: false },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, description: true, updatedAt: true },
    }),
    tursoDb.projectMember.findMany({
      where: { userId: user.id },
      select: { role: true, project: { select: { id: true, name: true, description: true, updatedAt: true } } },
    }),
  ])
  const rows = [
    ...owned.map((p) => ({ ...p, role: "dono" as const })),
    ...memberships.map((m) => ({ ...m.project, role: m.role })),
  ]
  if (rows.length === 0) return "Esta conta ainda não tem projetos no FlowBot."
  return [
    `Projetos desta conta (${rows.length}):`,
    ...rows.map(
      (p) =>
        `- ${p.name} — projeto_id: ${p.id} · cargo: ${ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}${p.description ? ` · ${clip(p.description, 120)}` : ""}`
    ),
    "",
    "Use ler_projeto com o projeto_id para ver requisitos, funcionalidades, tarefas e sprints.",
  ].join("\n")
}

export async function readProject(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  const context = await buildProjectContext(access.projectId, access.ownerId, 60000, {
    hideCosts: !access.canSeeCosts,
    devNotes: 10,
  })
  if (!context) throw new BridgeError("Projeto não encontrado.")
  return [
    context,
    "",
    permissionsLine(access),
    "",
    "COMO TRABALHAR COM O FLOWBOT:",
    "- listar_tarefas traz os ids e a descrição de cada tarefa (filtre por sprint ou coluna).",
    "- Ao começar uma tarefa, mova-a para a coluna de andamento; ao terminar, para a coluna de concluídas (mover_tarefa).",
    "- Registre o que fez, os problemas e as dúvidas com registrar_andamento: a equipe e as IAs do FlowBot leem isso para seguir o planejamento.",
    "- Trabalho novo descoberto no caminho (bug, ajuste) vira tarefa com criar_tarefa.",
  ].join("\n")
}

export async function listProjectTasks(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  const onlyOpen = args.somente_abertas !== false
  const tasks = await tursoDb.task.findMany({
    where: { projectId: access.projectId },
    orderBy: [{ order: "asc" }],
    select: taskSelect,
  })
  const sprint = typeof args.sprint === "string" && args.sprint.trim() ? norm(args.sprint) : null
  const column = typeof args.coluna === "string" && args.coluna.trim() ? norm(args.coluna) : null
  const filtered = tasks.filter(
    (t) =>
      (!onlyOpen || !t.column.isDone) &&
      (!sprint || (t.sprint && norm(t.sprint.name).includes(sprint))) &&
      (!column || norm(t.column.name).startsWith(column))
  )
  if (filtered.length === 0) return "Nenhuma tarefa com esses filtros."
  const lines = filtered.map((t) => {
    const meta = [
      t.column.name,
      t.priority,
      t.assignee ? `resp. ${t.assignee}` : null,
      t.participants.length ? `com ${t.participants.map((p) => p.name).join(", ")}` : null,
      t.dueDate ? `prazo ${formatDate(t.dueDate)}` : null,
      t.requirement?.code ?? null,
      t.feature ? `funcionalidade "${t.feature.name}"` : null,
      t.sprint?.name ?? null,
    ].filter(Boolean)
    const description = t.description ? `\n  ${clip(t.description, 400)}` : ""
    return `- [${t.id}] "${t.title}" (${meta.join(" · ")})${description}`
  })
  return [`${filtered.length} tarefa(s)${onlyOpen ? " aberta(s)" : ""}:`, ...lines].join("\n")
}

const PRIORITY_BY_NORM: Record<string, TaskPriority> = { alta: "Alta", media: "Média", baixa: "Baixa" }

export async function createProjectTask(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  if (!canManageBoard(access)) throw new BridgeError(`Sem permissão para criar tarefas. ${permissionsLine(access)}`)

  const title = typeof args.titulo === "string" ? args.titulo.trim() : ""
  if (!title) throw new BridgeError("Informe o titulo da tarefa.")
  if (title.length > 200) throw new BridgeError("Título longo demais (máximo de 200 caracteres).")
  const description = typeof args.descricao === "string" ? args.descricao.trim().slice(0, 4000) || null : null
  const priority = typeof args.prioridade === "string" ? PRIORITY_BY_NORM[norm(args.prioridade)] : "Média"
  if (!priority) throw new BridgeError("Prioridade deve ser Alta, Média ou Baixa.")

  const projectId = access.projectId
  let requirementId: string | null = null
  if (typeof args.requisito === "string" && args.requisito.trim()) {
    const req = await tursoDb.requirement.findFirst({
      where: { projectId, code: args.requisito.trim().toUpperCase() },
      select: { id: true },
    })
    if (!req) throw new BridgeError(`Requisito ${clip(args.requisito, 20)} não existe neste projeto.`)
    requirementId = req.id
  }
  let sprintId: string | null = null
  if (typeof args.sprint === "string" && args.sprint.trim()) {
    const wanted = norm(args.sprint)
    const sprints = await tursoDb.sprint.findMany({ where: { projectId }, select: { id: true, name: true } })
    const found = sprints.find((s) => norm(s.name) === wanted) ?? sprints.find((s) => norm(s.name).includes(wanted))
    if (!found) throw new BridgeError(`Sprint "${clip(args.sprint, 60)}" não existe. Sprints: ${sprints.map((s) => s.name).join(", ") || "nenhuma"}.`)
    sprintId = found.id
  }
  let featureId: string | null = null
  if (typeof args.funcionalidade === "string" && args.funcionalidade.trim()) {
    const wanted = norm(args.funcionalidade)
    const features = await tursoDb.feature.findMany({ where: { projectId }, select: { id: true, name: true } })
    const found = features.find((f) => norm(f.name) === wanted)
    if (!found) throw new BridgeError(`Funcionalidade "${clip(args.funcionalidade, 60)}" não existe neste projeto.`)
    featureId = found.id
  }

  const { column: chosen, columns } = await findColumn(projectId, args.coluna)
  const column = chosen ?? columns[0]
  const last = await tursoDb.task.findFirst({
    where: { columnId: column.id },
    orderBy: { order: "desc" },
    select: { order: true },
  })
  const task = await tursoDb.task.create({
    data: {
      title,
      description,
      priority,
      order: (last?.order ?? -1) + 1,
      columnId: column.id,
      projectId,
      requirementId,
      featureId,
      sprintId,
      // Primeira entrada do histórico: a coluna em que a tarefa nasceu (RF09).
      history: { create: { fromColumn: null, toColumn: column.name } },
    },
    select: { id: true, title: true },
  })
  return `Tarefa criada em "${column.name}": [${task.id}] "${task.title}".`
}

export async function moveProjectTask(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  const task = await findTask(access.projectId, args.tarefa)
  if (!canEditTask(access, task)) throw new BridgeError(`Sem permissão para mover esta tarefa. ${permissionsLine(access)}`)

  const { column } = await findColumn(access.projectId, args.coluna)
  if (!column) throw new BridgeError("Informe a coluna de destino.")
  if (column.id === task.columnId) return `A tarefa "${task.title}" já está em "${column.name}".`

  const last = await tursoDb.task.findFirst({
    where: { columnId: column.id },
    orderBy: { order: "desc" },
    select: { order: true },
  })
  await tursoDb.task.update({
    where: { id: task.id },
    data: {
      columnId: column.id,
      order: (last?.order ?? -1) + 1,
      history: { create: { fromColumn: task.column.name, toColumn: column.name } },
    },
  })
  // Mesmo efeito do quadro: concluir a última tarefa de um requisito avisa que ele está coberto.
  const effects = await emitProjectEvent({
    type: "task.moved",
    projectId: access.projectId,
    taskId: task.id,
    taskTitle: task.title,
    requirementId: task.requirementId,
    toColumnIsDone: column.isDone,
  })
  return [
    `Tarefa "${task.title}" movida de "${task.column.name}" para "${column.name}".`,
    ...effects.map((e) => `- ${e.message}`),
  ].join("\n")
}

const MAX_NOTE_LENGTH = 4000

export async function recordProgress(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  if (!access.canEdit.kanban) throw new BridgeError(`Sem permissão para registrar andamento. ${permissionsLine(access)}`)

  const message = typeof args.mensagem === "string" ? args.mensagem.trim() : ""
  if (!message) throw new BridgeError("Escreva a mensagem do andamento.")
  const kind = args.tipo ?? "progresso"
  if (!isDevNoteKind(kind)) throw new BridgeError(`tipo deve ser um de: ${DEV_NOTE_KINDS.join(", ")}.`)

  let link: string | null = null
  if (typeof args.link === "string" && args.link.trim()) {
    const value = args.link.trim()
    if (!/^https?:\/\/\S+$/i.test(value) || value.length > 500) throw new BridgeError("link deve ser um endereço http(s).")
    link = value
  }

  let task: Awaited<ReturnType<typeof findTask>> | null = null
  if (args.tarefa !== undefined && args.tarefa !== null && args.tarefa !== "") {
    task = await findTask(access.projectId, args.tarefa)
    if (!canEditTask(access, task)) throw new BridgeError(`Sem permissão nesta tarefa. ${permissionsLine(access)}`)
  } else if (access.ownTasksOnly) {
    throw new BridgeError("Com o cargo de estagiário, o andamento precisa apontar uma tarefa sua (campo tarefa).")
  }

  await tursoDb.devNote.create({
    data: {
      projectId: access.projectId,
      taskId: task?.id ?? null,
      authorId: user.id,
      kind,
      message: message.slice(0, MAX_NOTE_LENGTH),
      link,
    },
  })
  const where = task ? ` na tarefa "${task.title}"` : ""
  const hint =
    kind === "concluido" && task && !task.column.isDone
      ? "\nA tarefa ainda não está na coluna de concluídas: use mover_tarefa se ela terminou."
      : ""
  return `Andamento registrado (${DEV_NOTE_LABELS[kind]})${where}. Ele aparece na aba Desenvolvimento do projeto.${hint}`
}
