// Protocolo de ações do assistente FlowBot.
//
// O modelo nunca escreve no banco: ele apenas PROPÕE alterações emitindo um bloco
// ```flowbot-actions com JSON. A interface mostra a proposta ao usuário e só executa
// depois da confirmação explícita, chamando as mesmas rotas REST usadas pelas telas
// (com toda a validação e verificação de acesso ao projeto).

export type FlowbotAction =
  | { type: "create_requirement"; description: string; category?: string; priority?: string; status?: string; level?: string }
  | { type: "update_requirement"; code: string; description?: string; category?: string; priority?: string; status?: string; level?: string }
  | { type: "delete_requirement"; code: string }
  | { type: "create_feature"; name: string; description?: string; status?: string; requirementCode?: string }
  | { type: "update_feature"; name: string; description?: string; status?: string; requirementCode?: string }
  | { type: "create_sprint"; name: string; goal?: string; startDate: string; endDate: string }
  | { type: "create_component"; name: string; description?: string; quantity?: number; unitPrice?: number; domain?: string; requirementCode?: string }
  | {
      type: "create_task"
      title: string
      description?: string
      priority?: string
      assignee?: string
      participants?: string[]
      dueDate?: string
      requirementCode?: string
      featureName?: string
      sprintName?: string
      columnName?: string
    }
  | {
      type: "update_task"
      title: string
      description?: string
      priority?: string
      assignee?: string
      participants?: string[]
      dueDate?: string
      requirementCode?: string
      featureName?: string
      sprintName?: string
      columnName?: string
    }
  | { type: "move_task"; title: string; columnName: string }

export const ACTION_TYPES = [
  "create_requirement",
  "update_requirement",
  "delete_requirement",
  "create_feature",
  "update_feature",
  "create_sprint",
  "create_component",
  "create_task",
  "update_task",
  "move_task",
] as const

/** Grupo de cada ação no card de confirmação, na ordem em que o projeto se estrutura. */
export const ACTION_GROUPS = ["Requisitos", "Funcionalidades", "Sprints", "Tarefas", "Componentes"] as const
export type ActionGroup = (typeof ACTION_GROUPS)[number]

export function actionGroup(type: FlowbotAction["type"]): ActionGroup {
  if (type.endsWith("requirement")) return "Requisitos"
  if (type.endsWith("feature")) return "Funcionalidades"
  if (type.endsWith("sprint")) return "Sprints"
  if (type.endsWith("component")) return "Componentes"
  return "Tarefas"
}

const BLOCK_RE = /```flowbot-actions\s*([\s\S]*?)```/

// O modelo costuma responder sem acentuação ("Nao Funcional", "Media"). As rotas exigem os
// valores exatos, então canonizamos aqui, comparando sem acentos e sem caixa.
const deaccent = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

function canonical<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined
  return allowed.find((option) => deaccent(option) === deaccent(value))
}

const CATEGORIES = ["Funcional", "Não Funcional"] as const
const PRIORITIES = ["Alta", "Média", "Baixa"] as const
const REQUIREMENT_STATUSES = ["Em Aberto", "Validado", "Descartado"] as const
const FEATURE_STATUSES = ["Planejada", "Em desenvolvimento", "Concluída"] as const
const LEVELS = ["Sistema", "Subsistema", "Componente"] as const
const DOMAINS = ["Hardware", "Software"] as const

function normalizeAction(action: FlowbotAction): FlowbotAction {
  const a = { ...action } as Record<string, unknown>

  if ("category" in a) a.category = canonical(a.category, CATEGORIES)
  if ("priority" in a) a.priority = canonical(a.priority, PRIORITIES)
  if ("level" in a) a.level = canonical(a.level, LEVELS)
  if ("domain" in a) a.domain = canonical(a.domain, DOMAINS)
  if ("status" in a) {
    a.status =
      action.type === "create_feature" || action.type === "update_feature"
        ? canonical(a.status, FEATURE_STATUSES)
        : canonical(a.status, REQUIREMENT_STATUSES)
  }
  if ("participants" in a) {
    a.participants = Array.isArray(a.participants)
      ? a.participants.filter((p): p is string => typeof p === "string" && !!p.trim())
      : undefined
  }
  // Campos vazios devem virar "ausente" para a API aplicar os padrões.
  for (const key of ["description", "assignee", "dueDate", "featureName", "requirementCode", "columnName", "sprintName", "goal"]) {
    if (key in a && typeof a[key] === "string" && !(a[key] as string).trim()) a[key] = undefined
  }

  return a as FlowbotAction
}

function isAction(value: unknown): value is FlowbotAction {
  if (!value || typeof value !== "object") return false
  const type = (value as { type?: unknown }).type
  return typeof type === "string" && (ACTION_TYPES as readonly string[]).includes(type)
}

/**
 * Extrai as ações propostas de uma mensagem do assistente. Se a resposta foi cortada pelo
 * limite de tamanho (bloco sem fechamento ou JSON incompleto), aproveita as ações que
 * chegaram inteiras, em vez de perder a proposta toda.
 */
export function parseFlowbotActions(content: string): FlowbotAction[] {
  const match = content.match(BLOCK_RE)
  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim())
      const list = Array.isArray(parsed) ? parsed : parsed?.actions
      return Array.isArray(list) ? list.filter(isAction).map(normalizeAction) : []
    } catch {
      return salvageActions(match[1])
    }
  }
  const open = content.indexOf("```flowbot-actions")
  return open === -1 ? [] : salvageActions(content.slice(open))
}

/** Cada ação é um objeto sem chaves internas: pega os que fecharam e são JSON válido. */
function salvageActions(fragment: string): FlowbotAction[] {
  const found: FlowbotAction[] = []
  for (const candidate of fragment.match(/\{"type"[^{}]*\}/g) ?? []) {
    try {
      const value = JSON.parse(candidate)
      if (isAction(value)) found.push(normalizeAction(value))
    } catch {
      /* objeto cortado: fica de fora */
    }
  }
  return found
}

/**
 * Texto da mensagem sem o bloco técnico, para exibição ao usuário.
 * Durante o streaming o bloco chega incompleto: também é cortado, para o JSON nunca piscar
 * na tela.
 */
export function stripFlowbotActions(content: string): string {
  const withoutComplete = content.replace(BLOCK_RE, "")
  const openIndex = withoutComplete.indexOf("```flowbot-actions")
  const text = openIndex === -1 ? withoutComplete : withoutComplete.slice(0, openIndex)
  return text.trimEnd()
}

/** Se a mensagem ainda está sendo transmitida, o bloco pode estar incompleto. */
export function hasCompleteActionBlock(content: string): boolean {
  return BLOCK_RE.test(content)
}

function taskDetails(action: Extract<FlowbotAction, { type: "create_task" | "update_task" }>): string[] {
  return [
    action.columnName ?? (action.type === "create_task" ? "Backlog" : ""),
    action.priority ? `prioridade ${action.priority}` : action.type === "create_task" ? "prioridade Média" : "",
    action.assignee ? `responsável ${action.assignee}` : "",
    action.participants?.length ? `com ${action.participants.join(", ")}` : "",
    action.dueDate ? `prazo ${action.dueDate}` : "",
    action.sprintName ? `sprint ${action.sprintName}` : "",
    action.requirementCode ? `requisito ${action.requirementCode}` : "",
    action.featureName ? `func. ${action.featureName}` : "",
  ].filter(Boolean)
}

/** Rótulo legível de uma ação, usado no card de confirmação. */
export function describeAction(action: FlowbotAction): { verb: string; target: string; details: string[] } {
  switch (action.type) {
    case "create_requirement":
      return {
        verb: "Criar requisito",
        target: action.description,
        details: [
          action.category ?? "Funcional",
          `prioridade ${action.priority ?? "Média"}`,
          action.status ? `status ${action.status}` : "",
          action.level ? `nível ${action.level}` : "",
        ].filter(Boolean),
      }
    case "update_requirement":
      return {
        verb: "Alterar requisito",
        target: action.code,
        details: [
          action.description ? `descrição: ${action.description}` : "",
          action.category ? `categoria: ${action.category}` : "",
          action.priority ? `prioridade: ${action.priority}` : "",
          action.status ? `status: ${action.status}` : "",
          action.level ? `nível: ${action.level}` : "",
        ].filter(Boolean),
      }
    case "delete_requirement":
      return { verb: "Excluir requisito", target: action.code, details: [] }
    case "create_feature":
      return {
        verb: "Criar funcionalidade",
        target: action.name,
        details: [
          action.status ?? "Planejada",
          action.requirementCode ? `requisito ${action.requirementCode}` : "",
          action.description ?? "",
        ].filter(Boolean),
      }
    case "update_feature":
      return {
        verb: "Alterar funcionalidade",
        target: action.name,
        details: [
          action.status ? `status: ${action.status}` : "",
          action.requirementCode ? `requisito ${action.requirementCode}` : "",
          action.description ? `descrição: ${action.description}` : "",
        ].filter(Boolean),
      }
    case "create_sprint":
      return {
        verb: "Criar sprint",
        target: action.name,
        details: [`${action.startDate} a ${action.endDate}`, action.goal ? `objetivo: ${action.goal}` : ""].filter(Boolean),
      }
    case "create_component":
      return {
        verb: "Criar componente",
        target: action.name,
        details: [
          action.domain ?? "Hardware",
          `quantidade ${action.quantity ?? 1}`,
          `R$ ${(action.unitPrice ?? 0).toFixed(2)}`,
          action.requirementCode ? `requisito ${action.requirementCode}` : "",
        ].filter(Boolean),
      }
    case "create_task":
      return { verb: "Criar tarefa", target: action.title, details: taskDetails(action) }
    case "update_task":
      return { verb: "Alterar tarefa", target: action.title, details: taskDetails(action) }
    case "move_task":
      return { verb: "Mover tarefa", target: action.title, details: [`para ${action.columnName}`] }
  }
}

export interface ActionResult {
  action: FlowbotAction
  ok: boolean
  message: string
}

interface ProjectRefs {
  requirements: { id: string; code: string }[]
  features: { id: string; name: string }[]
  sprints: { id: string; name: string }[]
  columns: { id: string; name: string }[]
  tasks: { id: string; title: string }[]
}

async function loadRefs(projectId: string): Promise<ProjectRefs> {
  const [reqRes, featRes, kanbanRes] = await Promise.all([
    fetch(`/api/projects/${projectId}/requirements`),
    fetch(`/api/projects/${projectId}/features`),
    fetch(`/api/projects/${projectId}/kanban`),
  ])
  const [reqData, featData, kanban] = await Promise.all([
    reqRes.json(),
    featRes.json(),
    kanbanRes.json(),
  ])
  return {
    requirements: reqRes.ok ? reqData.requirements : [],
    features: featRes.ok ? featData.features : [],
    sprints: kanbanRes.ok ? kanban.sprints ?? [] : [],
    columns: kanbanRes.ok ? kanban.columns : [],
    tasks: kanbanRes.ok ? kanban.tasks : [],
  }
}

// Comparação de nomes e títulos sem acentos, caixa ou espaços extras: o modelo às vezes
// escreve "autenticacao" para "autenticação".
const norm = (v: string) => deaccent(v).replace(/\s+/g, " ")

/**
 * Acha um item pelo nome com tolerância: o modelo às vezes abrevia ("Sprint 2" para
 * "Sprint 2 — Conexão e envio"). Ordem: nome exato, parte antes do travessão, começo do nome
 * e, por fim, trecho contido, este só quando houver um único candidato.
 */
function findByName<T extends { name: string }>(list: T[], name?: string): T | undefined {
  if (!name?.trim()) return undefined
  const wanted = norm(name)
  const head = (v: string) => norm(v).split(/\s+[—–-]\s+/)[0]
  return (
    list.find((item) => norm(item.name) === wanted) ??
    list.find((item) => head(item.name) === head(name)) ??
    list.find((item) => norm(item.name).startsWith(`${wanted} `)) ??
    (() => {
      const partial = list.filter((item) => norm(item.name).includes(wanted))
      return partial.length === 1 ? partial[0] : undefined
    })()
  )
}

/** Chama a rota e devolve o corpo (sucesso) ou a mensagem de erro. */
async function call(
  url: string,
  method: string,
  body?: unknown
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.ok) return { ok: true, data }
  return { ok: false, error: data.error || `Falha HTTP ${res.status}` }
}

// Ordem de execução: o que é referenciado vem antes de quem referencia (requisito antes da
// funcionalidade, funcionalidade antes da tarefa), seja qual for a ordem da proposta. A sprint
// nova vem depois das tarefas: o sistema só cria sprint já com tarefas dentro, então ela nasce
// com as tarefas que apontam para ela.
const EXECUTION_ORDER: FlowbotAction["type"][] = [
  "create_requirement",
  "update_requirement",
  "create_feature",
  "update_feature",
  "create_component",
  "create_task",
  "create_sprint",
  "update_task",
  "move_task",
  "delete_requirement",
]

/**
 * Executa as ações confirmadas pelo usuário, uma a uma, e devolve o resultado de cada uma.
 * Nunca é chamada automaticamente: só a partir do botão de confirmação. Itens criados no
 * caminho entram nas referências, então uma tarefa pode apontar para a funcionalidade, a
 * sprint ou o requisito criados na mesma proposta.
 */
export async function executeFlowbotActions(
  projectId: string,
  actions: FlowbotAction[]
): Promise<ActionResult[]> {
  const refs = await loadRefs(projectId)
  const base = `/api/projects/${projectId}`
  const results: ActionResult[] = []

  const reqIdByCode = (code?: string) =>
    code ? refs.requirements.find((r) => norm(r.code) === norm(code))?.id : undefined
  const featIdByName = (name?: string) => findByName(refs.features, name)?.id
  const sprintIdByName = (name?: string) => findByName(refs.sprints, name)?.id
  const colIdByName = (name?: string) =>
    name ? refs.columns.find((c) => norm(c.name) === norm(name))?.id : undefined
  const taskByTitle = (title: string) =>
    refs.tasks.find((t) => norm(t.title) === norm(title)) ??
    refs.tasks.find((t) => norm(t.title).includes(norm(title)))

  const ordered = [...actions].sort(
    (a, b) => EXECUTION_ORDER.indexOf(a.type) - EXECUTION_ORDER.indexOf(b.type)
  )

  // Sprints novas desta proposta e as tarefas que vão entrar nelas.
  const newSprints = actions.flatMap((a) => (a.type === "create_sprint" ? [{ name: a.name }] : []))
  const tasksForNewSprint = new Map<string, string[]>()
  // Tarefas que já existem e foram movidas para uma sprint nova também entram na criação dela.
  for (const a of actions) {
    if (a.type !== "update_task") continue
    const target = findByName(newSprints, a.sprintName)
    const task = target ? taskByTitle(a.title) : undefined
    if (target && task) {
      const key = norm(target.name)
      tasksForNewSprint.set(key, [...(tasksForNewSprint.get(key) ?? []), task.id])
    }
  }

  for (const action of ordered) {
    const { verb, target } = describeAction(action)
    let error: string | null = null

    try {
      switch (action.type) {
        case "create_requirement": {
          const r = await call(`${base}/requirements`, "POST", {
            description: action.description,
            category: action.category ?? "Funcional",
            priority: action.priority ?? "Média",
            status: action.status,
            level: action.level,
          })
          if (!r.ok) { error = r.error; break }
          const created = r.data.requirement as { id: string; code: string } | undefined
          if (created) refs.requirements.push({ id: created.id, code: created.code })
          break
        }

        case "update_requirement": {
          const id = reqIdByCode(action.code)
          if (!id) { error = `Requisito ${action.code} não encontrado`; break }
          const r = await call(`${base}/requirements/${id}`, "PATCH", {
            description: action.description,
            category: action.category,
            priority: action.priority,
            status: action.status,
            level: action.level,
          })
          if (!r.ok) error = r.error
          break
        }

        case "delete_requirement": {
          const id = reqIdByCode(action.code)
          if (!id) { error = `Requisito ${action.code} não encontrado`; break }
          const r = await call(`${base}/requirements/${id}`, "DELETE")
          if (!r.ok) error = r.error
          break
        }

        case "create_feature": {
          const r = await call(`${base}/features`, "POST", {
            name: action.name,
            description: action.description,
            status: action.status,
            requirementId: reqIdByCode(action.requirementCode) ?? null,
          })
          if (!r.ok) { error = r.error; break }
          const created = r.data.feature as { id: string; name: string } | undefined
          if (created) refs.features.push({ id: created.id, name: created.name })
          break
        }

        case "update_feature": {
          const id = featIdByName(action.name)
          if (!id) { error = `Funcionalidade "${action.name}" não encontrada`; break }
          const r = await call(`${base}/features/${id}`, "PATCH", {
            description: action.description,
            status: action.status,
            ...(action.requirementCode ? { requirementId: reqIdByCode(action.requirementCode) ?? null } : {}),
          })
          if (!r.ok) error = r.error
          break
        }

        case "create_sprint": {
          const taskIds = tasksForNewSprint.get(norm(action.name)) ?? []
          if (taskIds.length === 0) {
            error = "uma sprint precisa de ao menos uma tarefa; inclua tarefas apontando para ela"
            break
          }
          const r = await call(`${base}/sprints`, "POST", {
            name: action.name,
            goal: action.goal,
            startDate: action.startDate,
            endDate: action.endDate,
            taskIds,
          })
          if (!r.ok) { error = r.error; break }
          const created = r.data.sprint as { id: string; name: string } | undefined
          if (created) refs.sprints.push({ id: created.id, name: created.name })
          break
        }

        case "create_component": {
          const r = await call(`${base}/components`, "POST", {
            name: action.name,
            description: action.description,
            quantity: action.quantity ?? 1,
            unitPrice: action.unitPrice ?? 0,
            domain: action.domain,
            requirementId: reqIdByCode(action.requirementCode) ?? null,
          })
          if (!r.ok) error = r.error
          break
        }

        case "create_task": {
          // Sprint que já existe: a tarefa entra direto. Sprint nova desta proposta: a tarefa
          // fica guardada e entra quando a sprint for criada, logo depois.
          const existingSprintId = sprintIdByName(action.sprintName)
          const pendingSprint = existingSprintId ? undefined : findByName(newSprints, action.sprintName)
          const r = await call(`${base}/tasks`, "POST", {
            title: action.title,
            description: action.description,
            priority: action.priority,
            assignee: action.assignee,
            participants: action.participants,
            dueDate: action.dueDate,
            columnId: colIdByName(action.columnName),
            requirementId: reqIdByCode(action.requirementCode) ?? null,
            featureId: featIdByName(action.featureName) ?? null,
            sprintId: existingSprintId ?? null,
          })
          if (!r.ok) { error = r.error; break }
          const created = r.data.task as { id: string; title: string } | undefined
          if (created) {
            refs.tasks.push({ id: created.id, title: created.title })
            if (pendingSprint) {
              const key = norm(pendingSprint.name)
              tasksForNewSprint.set(key, [...(tasksForNewSprint.get(key) ?? []), created.id])
            }
          }
          break
        }

        case "update_task": {
          const task = taskByTitle(action.title)
          if (!task) { error = `Tarefa "${action.title}" não encontrada`; break }
          const columnId = action.columnName ? colIdByName(action.columnName) : undefined
          if (action.columnName && !columnId) { error = `Coluna "${action.columnName}" não encontrada`; break }
          const r = await call(`${base}/tasks/${task.id}`, "PATCH", {
            description: action.description,
            priority: action.priority,
            assignee: action.assignee,
            participants: action.participants,
            dueDate: action.dueDate,
            columnId,
            ...(action.requirementCode ? { requirementId: reqIdByCode(action.requirementCode) ?? null } : {}),
            ...(action.featureName ? { featureId: featIdByName(action.featureName) ?? null } : {}),
            ...(action.sprintName ? { sprintId: sprintIdByName(action.sprintName) ?? null } : {}),
          })
          if (!r.ok) error = r.error
          break
        }

        case "move_task": {
          const task = taskByTitle(action.title)
          if (!task) { error = `Tarefa "${action.title}" não encontrada`; break }
          const columnId = colIdByName(action.columnName)
          if (!columnId) { error = `Coluna "${action.columnName}" não encontrada`; break }
          const r = await call(`${base}/tasks/${task.id}`, "PATCH", { columnId })
          if (!r.ok) error = r.error
          break
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Erro inesperado"
    }

    results.push({
      action,
      ok: error === null,
      message: error === null ? `${verb}: ${target}` : `${verb} "${target}" — ${error}`,
    })
  }

  return results
}
