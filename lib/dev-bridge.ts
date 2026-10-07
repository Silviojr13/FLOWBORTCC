import { tursoDb } from "./turso-db"
import { getProjectAccess, type ProjectAccess } from "./project-access"
import { buildProjectContext } from "./project-context"
import { emitProjectEvent } from "./project-events"
import {
  ensureKanbanColumns,
  MAX_TASK_PARTICIPANTS,
  normalizeTaskTeam,
  parseDateInput,
  participantsWrite,
} from "./kanban-server"
import { formatDate, TASK_PRIORITIES, type TaskPriority } from "./kanban"
import { ROLE_LABELS, canEditTask, canManageBoard } from "./project-permissions"
import { DEV_NOTE_KINDS, DEV_NOTE_LABELS, isDevNoteKind } from "./dev-notes"
import {
  nextRequirementCode,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_CATEGORY_PREFIX,
  REQUIREMENT_LEVELS,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_STATUSES,
} from "./requirements-server"
import { COMPONENT_DOMAINS } from "./resources"
import { COUNCIL_ROLE_INFO, COUNCIL_ROLES } from "./council"
import { AI_PROVIDER_INFO } from "./ai-providers"
import { AiProviderError, friendlyAiError, openChatStream, readChatStream, type AiTarget } from "./ai-client"
import { assistantAiKey } from "./user-ai-keys"
import { FLOWBOT_ACTIONS_FORMAT } from "./flowbot-action-prompt"
import { parseFlowbotActions, type FlowbotAction } from "./flowbot-actions"

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

/** Campo de texto opcional: ausente -> undefined; "" -> null (limpa o campo na edição). */
function optionalText(value: unknown, field: string, max: number): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") throw new BridgeError(`${field} deve ser um texto.`)
  const clean = value.trim()
  if (clean.length > max) throw new BridgeError(`${field} longo demais (máximo de ${max} caracteres).`)
  return clean || null
}

/** Um dos valores aceitos, sem diferenciar acento e maiúsculas: "media" -> "Média". */
function pick<T extends string>(value: unknown, allowed: readonly T[], field: string): T | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const found = typeof value === "string" ? allowed.find((option) => norm(option) === norm(value)) : undefined
  if (!found) throw new BridgeError(`${field} deve ser um de: ${allowed.join(", ")}.`)
  return found
}

/** "" ou null desfazem o vínculo na edição; ausente não mexe. */
const isClear = (value: unknown) => value === null || (typeof value === "string" && !value.trim())

async function findRequirement(projectId: string, code: unknown) {
  if (typeof code !== "string" || !code.trim()) throw new BridgeError("Informe o código do requisito, ex.: RF03.")
  const requirement = await tursoDb.requirement.findFirst({ where: { projectId, code: code.trim().toUpperCase() } })
  if (!requirement) throw new BridgeError(`Requisito ${clip(code, 20)} não existe neste projeto. Use ler_projeto para ver os códigos.`)
  return requirement
}

async function findSprint(projectId: string, name: string) {
  const wanted = norm(name)
  const sprints = await tursoDb.sprint.findMany({ where: { projectId }, select: { id: true, name: true } })
  const found = sprints.find((s) => norm(s.name) === wanted) ?? sprints.find((s) => norm(s.name).includes(wanted))
  if (!found) throw new BridgeError(`Sprint "${clip(name, 60)}" não existe. Sprints: ${sprints.map((s) => s.name).join(", ") || "nenhuma"}.`)
  return found
}

async function findFeature(projectId: string, name: string) {
  const wanted = norm(name)
  const features = await tursoDb.feature.findMany({ where: { projectId }, select: { id: true, name: true } })
  const found = features.find((f) => norm(f.name) === wanted)
  if (!found) {
    throw new BridgeError(`Funcionalidade "${clip(name, 60)}" não existe neste projeto. Funcionalidades: ${features.map((f) => f.name).join(", ") || "nenhuma"}.`)
  }
  return found
}

/** Responsável e participantes; os campos que não vierem partem do que a tarefa já tem. */
function parseTeam(
  args: Record<string, unknown>,
  current: { assignee: string | null; participants: string[] }
): { assignee: string | null; participants: string[] } {
  const list = args.participantes
  if (list !== undefined && list !== null && (!Array.isArray(list) || list.some((p) => typeof p !== "string"))) {
    throw new BridgeError("participantes deve ser uma lista de nomes.")
  }
  const others = Array.isArray(list) ? list : list === null ? [] : current.participants
  const team = normalizeTaskTeam(args.responsavel !== undefined ? args.responsavel : current.assignee, others)
  if (team === "too-many") throw new BridgeError(`Uma tarefa tem no máximo ${MAX_TASK_PARTICIPANTS} participantes além do responsável.`)
  return team
}

/** Prazo ou data em AAAA-MM-DD. */
function parseDay(value: unknown, field: string): Date | null {
  const parsed = parseDateInput(value)
  if (parsed === "invalid") throw new BridgeError(`${field} inválido: use o formato AAAA-MM-DD.`)
  return parsed
}

function permissionsLine(access: ProjectAccess): string {
  const what = access.readOnly
    ? "só leitura (não cria, não move tarefas nem registra andamento)"
    : access.ownTasksOnly
      ? "move e registra andamento só nas tarefas em que a conta é responsável ou participante; não cria tarefas"
      : access.canEdit.kanban
        ? "cria e move tarefas e registra andamento"
        : "só leitura no quadro"
  const areas = (Object.keys(AREA_LABELS) as (keyof typeof AREA_LABELS)[]).filter((area) => access.canEdit[area])
  const editable = areas.length ? ` Edita: ${areas.map((area) => AREA_LABELS[area]).join(", ")}.` : ""
  return `Cargo desta conta no projeto: ${ROLE_LABELS[access.role]} — ${what}.${editable}`
}

const AREA_LABELS = {
  requisitos: "requisitos",
  funcionalidades: "funcionalidades",
  sprints: "sprints",
  kanban: "tarefas",
  componentes: "componentes",
  assistente: "IAs do FlowBot (acionar_ia)",
} as const

function requireEdit(access: ProjectAccess, area: keyof typeof AREA_LABELS, action: string) {
  if (!access.canEdit[area]) throw new BridgeError(`Sem permissão para ${action}. ${permissionsLine(access)}`)
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
    "- Para gerir o projeto: criar_requisito / atualizar_requisito, criar_funcionalidade, criar_sprint, criar_componente, atualizar_tarefa, ler_tarefa e excluir_tarefa (confirme antes de excluir).",
    "- acionar_ia consulta as IAs do FlowBot (assistente, gerente, revisor_requisitos...) com este contexto; o que elas propõem você aplica com as ferramentas acima.",
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
  const dueDate = args.prazo !== undefined ? parseDay(args.prazo, "prazo") : null
  const team = parseTeam(args, { assignee: null, participants: [] })

  const projectId = access.projectId
  const requirementId =
    typeof args.requisito === "string" && args.requisito.trim() ? (await findRequirement(projectId, args.requisito)).id : null
  const sprintId = typeof args.sprint === "string" && args.sprint.trim() ? (await findSprint(projectId, args.sprint)).id : null
  const featureId =
    typeof args.funcionalidade === "string" && args.funcionalidade.trim()
      ? (await findFeature(projectId, args.funcionalidade)).id
      : null

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
      dueDate,
      assignee: team.assignee,
      participants: { create: team.participants.map((name, order) => ({ name, order })) },
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

/* ---------------------------------------------------------------- tarefas: ler, editar, excluir */

export async function readProjectTask(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  const found = await findTask(access.projectId, args.tarefa)
  const [task, history, notes] = await Promise.all([
    tursoDb.task.findUnique({
      where: { id: found.id },
      select: { createdAt: true, updatedAt: true, requirement: { select: { code: true, description: true } } },
    }),
    tursoDb.taskHistory.findMany({ where: { taskId: found.id }, orderBy: { changedAt: "asc" }, take: 30 }),
    tursoDb.devNote.findMany({ where: { taskId: found.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ])
  const lines = [
    `Tarefa [${found.id}] "${found.title}"`,
    `- Coluna: ${found.column.name}${found.column.isDone ? " (concluída)" : ""}`,
    `- Prioridade: ${found.priority}`,
    `- Responsável: ${found.assignee ?? "ninguém"}${found.participants.length ? ` · participantes: ${found.participants.map((p) => p.name).join(", ")}` : ""}`,
    `- Prazo: ${found.dueDate ? formatDate(found.dueDate) : "sem prazo"}`,
    `- Requisito: ${task?.requirement ? `${task.requirement.code} — ${clip(task.requirement.description, 200)}` : "nenhum"}`,
    `- Funcionalidade: ${found.feature?.name ?? "nenhuma"} · Sprint: ${found.sprint?.name ?? "nenhuma"}`,
    task ? `- Criada em ${formatDate(task.createdAt)}, alterada em ${formatDate(task.updatedAt)}` : null,
    "",
    "Descrição:",
    found.description?.trim() || "(sem descrição)",
  ]
  if (history.length) {
    lines.push("", "Histórico de colunas:")
    lines.push(...history.map((h) => `- ${formatDate(h.changedAt)}: ${h.fromColumn ?? "(criada)"} → ${h.toColumn}`))
  }
  if (notes.length) {
    lines.push("", "Andamento registrado nesta tarefa (mais recentes primeiro):")
    lines.push(...notes.map((n) => `- ${formatDate(n.createdAt)} · ${DEV_NOTE_LABELS[n.kind as keyof typeof DEV_NOTE_LABELS] ?? n.kind}: ${clip(n.message, 500)}${n.link ? ` (${n.link})` : ""}`))
  }
  return lines.filter((l) => l !== null).join("\n")
}

export async function updateProjectTask(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  const task = await findTask(access.projectId, args.tarefa)
  if (!canEditTask(access, task)) throw new BridgeError(`Sem permissão para alterar esta tarefa. ${permissionsLine(access)}`)
  const projectId = access.projectId

  const data: Record<string, unknown> = {}
  const changed: string[] = []

  if (args.titulo !== undefined) {
    const title = optionalText(args.titulo, "titulo", 200)
    if (!title) throw new BridgeError("O título da tarefa não pode ficar vazio.")
    data.title = title
    changed.push(`título "${title}"`)
  }
  if (args.descricao !== undefined) {
    data.description = optionalText(args.descricao, "descricao", 4000)
    changed.push(data.description ? "descrição" : "descrição removida")
  }
  if (args.prioridade !== undefined) {
    const priority = pick(args.prioridade, TASK_PRIORITIES, "prioridade")
    if (!priority) throw new BridgeError("prioridade deve ser Alta, Média ou Baixa.")
    data.priority = priority
    changed.push(`prioridade ${priority}`)
  }
  if (args.prazo !== undefined) {
    data.dueDate = parseDay(args.prazo, "prazo")
    changed.push(data.dueDate ? `prazo ${formatDate(data.dueDate as Date)}` : "prazo removido")
  }
  if (args.requisito !== undefined) {
    data.requirementId = isClear(args.requisito) ? null : (await findRequirement(projectId, args.requisito)).id
    changed.push(data.requirementId ? `requisito ${String(args.requisito).trim().toUpperCase()}` : "requisito desvinculado")
  }
  if (args.funcionalidade !== undefined) {
    const feature = isClear(args.funcionalidade) ? null : await findFeature(projectId, String(args.funcionalidade))
    data.featureId = feature?.id ?? null
    changed.push(feature ? `funcionalidade "${feature.name}"` : "funcionalidade desvinculada")
  }
  if (args.sprint !== undefined) {
    const sprint = isClear(args.sprint) ? null : await findSprint(projectId, String(args.sprint))
    data.sprintId = sprint?.id ?? null
    changed.push(sprint ? `sprint "${sprint.name}"` : "sprint desvinculada")
  }
  if (args.responsavel !== undefined || args.participantes !== undefined) {
    const team = parseTeam(args, { assignee: task.assignee, participants: task.participants.map((p) => p.name) })
    data.assignee = team.assignee
    data.participants = participantsWrite(team.participants)
    changed.push(`equipe: ${[team.assignee, ...team.participants].filter(Boolean).join(", ") || "ninguém"}`)
  }

  const moving = typeof args.coluna === "string" && args.coluna.trim()
  if (changed.length === 0 && !moving) {
    throw new BridgeError("Nada para alterar: informe ao menos um campo (titulo, descricao, prioridade, prazo, requisito, funcionalidade, sprint, responsavel, participantes, coluna).")
  }
  if (changed.length) await tursoDb.task.update({ where: { id: task.id }, data })
  const lines = changed.length ? [`Tarefa "${task.title}" atualizada: ${changed.join("; ")}.`] : []
  // A troca de coluna segue o mesmo caminho de mover_tarefa (histórico e efeitos no requisito).
  if (moving) lines.push(await moveProjectTask(user, { projeto_id: access.projectId, tarefa: task.id, coluna: args.coluna }))
  return lines.join("\n")
}

export async function deleteProjectTask(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  if (!canManageBoard(access)) throw new BridgeError(`Sem permissão para excluir tarefas. ${permissionsLine(access)}`)
  const task = await findTask(access.projectId, args.tarefa)
  await tursoDb.task.delete({ where: { id: task.id } })
  return `Tarefa "${task.title}" (${task.column.name}) excluída de vez, com o histórico dela. O andamento registrado nela continua na aba Desenvolvimento, sem o vínculo.`
}

/* ---------------------------------------------------------------- requisitos */

export async function createProjectRequirement(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  requireEdit(access, "requisitos", "criar requisitos")
  const projectId = access.projectId

  const tipo = typeof args.tipo === "string" ? args.tipo.trim().toUpperCase() : args.tipo
  const category = tipo === "RF" ? "Funcional" : tipo === "RNF" ? "Não Funcional" : pick(args.tipo, REQUIREMENT_CATEGORIES, "tipo")
  if (!category) throw new BridgeError("Informe o tipo: Funcional ou Não Funcional.")
  const description = optionalText(args.descricao, "descricao", 2000)
  if (!description) throw new BridgeError("Informe a descricao do requisito.")
  const priority = pick(args.prioridade, REQUIREMENT_PRIORITIES, "prioridade") ?? "Média"
  const status = pick(args.status, REQUIREMENT_STATUSES, "status") ?? "Em Aberto"
  const level = pick(args.nivel, REQUIREMENT_LEVELS, "nivel") ?? null

  let code: string
  if (typeof args.codigo === "string" && args.codigo.trim()) {
    code = args.codigo.trim().toUpperCase()
    const prefix = REQUIREMENT_CATEGORY_PREFIX[category]
    if (!new RegExp(`^${prefix}\\d+$`).test(code)) {
      throw new BridgeError(`Código ${clip(code, 20)} não combina com o tipo ${category}: use ${prefix} seguido do número (ex.: ${prefix}08), ou omita para gerar o próximo.`)
    }
    const taken = await tursoDb.requirement.findFirst({ where: { projectId, code }, select: { id: true } })
    if (taken) throw new BridgeError(`Já existe o requisito ${code} neste projeto. Use atualizar_requisito para mudá-lo, ou omita o código.`)
  } else {
    code = await nextRequirementCode(projectId, category)
  }

  await tursoDb.requirement.create({ data: { code, description, category, priority, status, level, projectId } })
  return `Requisito ${code} criado (${category}, prioridade ${priority}, ${status}): ${clip(description, 200)}`
}

export async function updateProjectRequirement(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  requireEdit(access, "requisitos", "alterar requisitos")
  const existing = await findRequirement(access.projectId, args.requisito)

  const description = args.descricao !== undefined ? optionalText(args.descricao, "descricao", 2000) : undefined
  if (args.descricao !== undefined && !description) throw new BridgeError("A descrição do requisito não pode ficar vazia.")
  const priority = pick(args.prioridade, REQUIREMENT_PRIORITIES, "prioridade")
  const status = pick(args.status, REQUIREMENT_STATUSES, "status")
  const level = isClear(args.nivel) && args.nivel !== undefined ? null : pick(args.nivel, REQUIREMENT_LEVELS, "nivel")
  if (description === undefined && !priority && !status && level === undefined) {
    throw new BridgeError("Nada para alterar: informe descricao, prioridade, status ou nivel.")
  }
  // Só o que de fato muda: valor igual ao atual não conta como alteração.
  const newDescription = description !== undefined && description !== existing.description ? description : undefined
  const newPriority = priority && priority !== existing.priority ? priority : undefined
  const newStatus = status && status !== existing.status ? status : undefined
  const newLevel = level !== undefined && level !== existing.level ? level : undefined
  if (newDescription === undefined && !newPriority && !newStatus && newLevel === undefined) {
    return `Requisito ${existing.code} já está assim; nada mudou.`
  }

  // Guarda o estado anterior no histórico, como a tela faz (RF03 / RNF04).
  await tursoDb.requirementHistory.create({
    data: {
      requirementId: existing.id,
      description: existing.description,
      category: existing.category,
      priority: existing.priority,
      status: existing.status,
      level: existing.level,
    },
  })
  const requirement = await tursoDb.requirement.update({
    where: { id: existing.id },
    data: { description: newDescription ?? undefined, priority: newPriority, status: newStatus, level: newLevel },
  })
  const effects =
    newStatus
      ? await emitProjectEvent({
          type: "requirement.status_changed",
          projectId: access.projectId,
          requirementId: requirement.id,
          code: requirement.code,
          from: existing.status,
          to: requirement.status,
        })
      : []
  const changed = [
    newDescription !== undefined ? "descrição" : null,
    newPriority ? `prioridade ${existing.priority} → ${newPriority}` : null,
    newStatus ? `status ${existing.status} → ${newStatus}` : null,
    newLevel !== undefined ? `nível ${newLevel ?? "removido"}` : null,
  ].filter(Boolean)
  return [
    `Requisito ${requirement.code} atualizado: ${changed.join("; ")}. A versão anterior ficou no histórico do requisito.`,
    ...effects.map((e) => `- ${e.message}`),
  ].join("\n")
}

/* ---------------------------------------------------------------- funcionalidades, sprints, componentes */

const FEATURE_STATUSES = ["Planejada", "Em desenvolvimento", "Concluída"] as const

export async function createProjectFeature(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  requireEdit(access, "funcionalidades", "criar funcionalidades")
  const name = optionalText(args.nome, "nome", 200)
  if (!name) throw new BridgeError("Informe o nome da funcionalidade.")
  const features = await tursoDb.feature.findMany({ where: { projectId: access.projectId }, select: { name: true } })
  if (features.some((f) => norm(f.name) === norm(name))) throw new BridgeError(`Já existe a funcionalidade "${name}" neste projeto.`)
  const status = pick(args.status, FEATURE_STATUSES, "status") ?? "Planejada"
  const requirement =
    typeof args.requisito === "string" && args.requisito.trim() ? await findRequirement(access.projectId, args.requisito) : null

  await tursoDb.feature.create({
    data: {
      name,
      description: optionalText(args.descricao, "descricao", 2000) ?? null,
      status,
      projectId: access.projectId,
      requirementId: requirement?.id ?? null,
    },
  })
  return `Funcionalidade "${name}" criada (${status}${requirement ? `, ligada a ${requirement.code}` : ""}).`
}

export async function createProjectSprint(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  requireEdit(access, "sprints", "criar sprints")
  const name = optionalText(args.nome, "nome", 200)
  if (!name) throw new BridgeError("Informe o nome da sprint.")
  const start = parseDay(args.inicio, "inicio")
  const end = parseDay(args.fim, "fim")
  if (!start || !end) throw new BridgeError("Informe inicio e fim da sprint (AAAA-MM-DD).")
  if (end.getTime() < start.getTime()) throw new BridgeError("O fim da sprint deve ser igual ou posterior ao início.")

  // Mesma regra da tela: a sprint nasce com ao menos uma tarefa.
  if (!Array.isArray(args.tarefas) || args.tarefas.length === 0) {
    throw new BridgeError("Informe tarefas: a lista (ids ou títulos exatos) das tarefas que compõem a sprint, ao menos uma.")
  }
  if (args.tarefas.length > 100) throw new BridgeError("No máximo 100 tarefas por sprint neste pedido.")
  const tasks = []
  for (const ref of args.tarefas) tasks.push(await findTask(access.projectId, ref))
  const taskIds = [...new Set(tasks.map((t) => t.id))]

  const sprint = await tursoDb.$transaction(async (tx) => {
    const created = await tx.sprint.create({
      data: {
        name,
        goal: optionalText(args.objetivo, "objetivo", 1000) ?? null,
        startDate: start,
        endDate: end,
        projectId: access.projectId,
      },
    })
    await tx.task.updateMany({ where: { id: { in: taskIds } }, data: { sprintId: created.id } })
    return created
  })
  return `Sprint "${sprint.name}" criada de ${formatDate(start)} a ${formatDate(end)} com ${taskIds.length} tarefa(s).`
}

export async function createProjectComponent(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  requireEdit(access, "componentes", "criar componentes")
  const name = optionalText(args.nome, "nome", 200)
  if (!name) throw new BridgeError("Informe o nome do componente.")
  const quantity = args.quantidade === undefined ? 1 : Number(args.quantidade)
  if (!Number.isInteger(quantity) || quantity < 1) throw new BridgeError("quantidade deve ser um número inteiro maior ou igual a 1.")
  const unitPrice = args.preco_unitario === undefined ? 0 : Number(args.preco_unitario)
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new BridgeError("preco_unitario deve ser um número maior ou igual a 0.")
  const domain = pick(args.dominio, COMPONENT_DOMAINS, "dominio") ?? "Hardware"
  const requirement =
    typeof args.requisito === "string" && args.requisito.trim() ? await findRequirement(access.projectId, args.requisito) : null

  await tursoDb.hardwareComponent.create({
    data: {
      name,
      description: optionalText(args.descricao, "descricao", 2000) ?? null,
      quantity,
      unitPrice,
      domain,
      projectId: access.projectId,
      requirementId: requirement?.id ?? null,
    },
  })
  const price = access.canSeeCosts ? ` · R$ ${unitPrice.toFixed(2)} cada` : ""
  return `Componente "${name}" criado (${domain}, ${quantity} un.${price}${requirement ? `, ligado a ${requirement.code}` : ""}).`
}

/* ---------------------------------------------------------------- IAs do FlowBot */

export const AI_AGENTS = ["assistente", ...COUNCIL_ROLES.filter((role) => role !== "personalizado")] as const
type AiAgent = (typeof AI_AGENTS)[number]

const AGENT_INFO: Record<AiAgent, { label: string; focus: string }> = {
  assistente: { label: "Assistente do FlowBot", focus: "o projeto inteiro: planejar, estruturar e responder sobre ele" },
  ...(Object.fromEntries(
    COUNCIL_ROLES.filter((role) => role !== "personalizado").map((role) => [role, COUNCIL_ROLE_INFO[role]])
  ) as Record<Exclude<AiAgent, "assistente">, { label: string; focus: string }>),
}

/** Mesmos limites do assistente: a IA gratuita (Groq) aceita pouco por minuto. */
const AI_LIMITS = {
  compact: { contextChars: 4500, maxTokens: 900, devNotes: 3, maxActions: 12, lines: 8 },
  full: { contextChars: 16000, maxTokens: 4000, devNotes: 8, maxActions: 30, lines: 25 },
}

/** A ferramenta do MCP que aplica cada tipo de ação que a IA propõe. */
const ACTION_TOOL: Record<FlowbotAction["type"], string | null> = {
  create_requirement: "criar_requisito",
  update_requirement: "atualizar_requisito",
  delete_requirement: null,
  create_feature: "criar_funcionalidade",
  update_feature: null,
  create_sprint: "criar_sprint",
  create_task: "criar_tarefa",
  update_task: "atualizar_tarefa",
  move_task: "mover_tarefa",
  create_component: "criar_componente",
}

/** Campos do protocolo de ações -> argumentos das ferramentas do MCP. */
const ACTION_FIELD_TO_ARG: Record<string, string> = {
  code: "requisito",
  requirementCode: "requisito",
  description: "descricao",
  category: "tipo",
  priority: "prioridade",
  level: "nivel",
  name: "nome",
  goal: "objetivo",
  startDate: "inicio",
  endDate: "fim",
  featureName: "funcionalidade",
  sprintName: "sprint",
  columnName: "coluna",
  assignee: "responsavel",
  participants: "participantes",
  dueDate: "prazo",
  quantity: "quantidade",
  unitPrice: "preco_unitario",
  domain: "dominio",
}

function actionArgs(action: FlowbotAction, projectId: string): Record<string, unknown> {
  const args: Record<string, unknown> = { projeto_id: projectId }
  for (const [field, value] of Object.entries(action)) {
    if (field === "type" || value === undefined) continue
    // atualizar_requisito não troca o tipo: o código (RF/RNF) depende dele.
    if (action.type === "update_requirement" && field === "category") continue
    // Na criação o título é o da tarefa nova; nas outras, aponta a tarefa a alterar.
    const arg = field === "title" ? (action.type === "create_task" ? "titulo" : "tarefa") : (ACTION_FIELD_TO_ARG[field] ?? field)
    args[arg] = value
  }
  return args
}

export async function askProjectAi(user: BridgeUser, args: Record<string, unknown>): Promise<string> {
  const access = await accessOrFail(args.projeto_id, user)
  requireEdit(access, "assistente", "acionar as IAs do FlowBot")
  const instruction = optionalText(args.instrucao, "instrucao", 4000)
  if (!instruction) throw new BridgeError("Escreva a instrucao para a IA.")
  const agent = pick(args.agente, AI_AGENTS, "agente") ?? "assistente"
  const info = AGENT_INFO[agent]

  // Quem responde: a IA escolhida em "Minhas IAs" ou a IA gratuita do FlowBot, como no assistente.
  const ownKey = await assistantAiKey(user.id)
  if (ownKey && !ownKey.target) {
    throw new BridgeError("Não foi possível abrir a chave da IA escolhida em Minhas IAs. Conecte-a de novo ou volte para a IA gratuita do FlowBot.")
  }
  let target: AiTarget
  if (ownKey?.target) {
    target = ownKey.target
  } else {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new BridgeError("A IA gratuita do FlowBot não está configurada no servidor.")
    target = { provider: "groq", apiKey, model: process.env.GROQ_MODEL_NAME || "qwen/qwen3.8-27b" }
  }
  const usingOwnKey = Boolean(ownKey?.target)
  const limits = usingOwnKey && target.provider !== "groq" ? AI_LIMITS.full : AI_LIMITS.compact
  const providerLabel = usingOwnKey ? `${AI_PROVIDER_INFO[target.provider].label} (chave própria)` : "FlowBot (Groq)"

  const context = await buildProjectContext(access.projectId, access.ownerId, limits.contextChars, {
    hideCosts: !access.canSeeCosts,
    devNotes: limits.devNotes,
  })
  if (!context) throw new BridgeError("Projeto não encontrado.")
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })

  const system = `Voce e o ${info.label} do FlowBot, a plataforma de gestao deste projeto.
Seu foco: ${info.focus}.
Quem pede e uma IA de desenvolvimento (Claude Code, pelo servidor MCP) trabalhando no projeto em nome de ${user.name ?? "um membro da equipe"}. Hoje e ${today}: datas novas comecam a partir de hoje.

Regras:
- Responda em portugues brasileiro, baseado SOMENTE nos dados abaixo: cite requisitos pelo codigo e tarefas e sprints pelo nome. Nunca invente dados.
- Copie os codigos exatamente como estao nos dados: RF (funcional) e RNF (nao funcional) sao requisitos diferentes; confira a descricao antes de citar.
- Va direto ao ponto: no maximo ${limits.lines} linhas de texto, sem mostrar seu raciocinio nem repetir os dados.
- Se a instrucao pedir alteracoes no projeto, proponha-as no bloco flowbot-actions (no maximo ${limits.maxActions} acoes, JSON enxuto). Elas NAO sao aplicadas automaticamente: quem pediu decide e aplica.
- Nao invente cronograma: so proponha prazo (dueDate) ou datas de sprint quando o projeto ja tiver datas (do projeto ou de sprints) ou quando a instrucao pedir.
- Se for so uma pergunta ou analise, responda sem o bloco.

--- DADOS DO PROJETO ---
${context}
--- FIM DOS DADOS ---

${FLOWBOT_ACTIONS_FORMAT}`

  let res: Response
  try {
    res = await openChatStream(target, { system, messages: [{ role: "user", content: instruction }], maxTokens: limits.maxTokens }, { logLabel: "MCP-IA" })
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw new BridgeError(friendlyAiError(error, { providerOf: AI_PROVIDER_INFO[target.provider].of, ownKey: usingOwnKey }))
    }
    throw error
  }
  let text = ""
  let cut = false
  for await (const piece of readChatStream(target.provider, res)) {
    if (piece.text) text += piece.text
    if (piece.cutByLength) cut = true
  }
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim()

  const actions = parseFlowbotActions(text)
  const answer = text.replace(/```flowbot-actions[\s\S]*?(```|$)/, "").trim()
  const lines = [`Resposta do ${info.label} (${providerLabel}):`, "", answer || "(sem texto)"]
  if (cut) lines.push("", "(A resposta foi cortada pelo limite de tamanho. Peça uma parte menor de cada vez.)")
  if (actions.length) {
    lines.push("", `A IA propôs ${actions.length} alteração(ões). NADA foi aplicado; para aplicar, chame a ferramenta indicada com estes argumentos (criar_sprint também pede a lista tarefas):`)
    for (const action of actions) {
      const tool = ACTION_TOOL[action.type]
      lines.push(`- ${tool ? `[${tool}]` : `[${action.type}: sem ferramenta no MCP, faça pela tela]`} ${JSON.stringify(actionArgs(action, access.projectId))}`)
    }
  }
  return lines.join("\n")
}
