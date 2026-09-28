// Protocolo de ações do assistente FlowBot.
//
// O modelo nunca escreve no banco: ele apenas PROPÕE alterações emitindo um bloco
// ```flowbot-actions com JSON. A interface mostra a proposta ao usuário e só executa
// depois da confirmação explícita, chamando as mesmas rotas REST usadas pelas telas
// (com toda a validação e verificação de propriedade do projeto).

export type FlowbotAction =
  | { type: "create_requirement"; description: string; category?: string; priority?: string; status?: string; level?: string }
  | { type: "update_requirement"; code: string; description?: string; category?: string; priority?: string; status?: string; level?: string }
  | { type: "delete_requirement"; code: string }
  | { type: "create_feature"; name: string; description?: string; status?: string; requirementCode?: string }
  | { type: "create_component"; name: string; description?: string; quantity?: number; unitPrice?: number; requirementCode?: string }
  | { type: "create_task"; title: string; description?: string; priority?: string; assignee?: string; dueDate?: string; requirementCode?: string; featureName?: string; columnName?: string }
  | { type: "move_task"; title: string; columnName: string }

export const ACTION_TYPES = [
  "create_requirement",
  "update_requirement",
  "delete_requirement",
  "create_feature",
  "create_component",
  "create_task",
  "move_task",
] as const

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

function normalizeAction(action: FlowbotAction): FlowbotAction {
  const a = { ...action } as Record<string, unknown>

  if ("category" in a) a.category = canonical(a.category, CATEGORIES)
  if ("priority" in a) a.priority = canonical(a.priority, PRIORITIES)
  if ("level" in a) a.level = canonical(a.level, LEVELS)
  if ("status" in a) {
    a.status =
      action.type === "create_feature"
        ? canonical(a.status, FEATURE_STATUSES)
        : canonical(a.status, REQUIREMENT_STATUSES)
  }
  // Campos vazios devem virar "ausente" para a API aplicar os padrões.
  for (const key of ["description", "assignee", "dueDate", "featureName", "requirementCode", "columnName"]) {
    if (key in a && typeof a[key] === "string" && !(a[key] as string).trim()) a[key] = undefined
  }

  return a as FlowbotAction
}

function isAction(value: unknown): value is FlowbotAction {
  if (!value || typeof value !== "object") return false
  const type = (value as { type?: unknown }).type
  return typeof type === "string" && (ACTION_TYPES as readonly string[]).includes(type)
}

/** Extrai as ações propostas de uma mensagem do assistente. */
export function parseFlowbotActions(content: string): FlowbotAction[] {
  const match = content.match(BLOCK_RE)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[1].trim())
    const list = Array.isArray(parsed) ? parsed : parsed?.actions
    return Array.isArray(list) ? list.filter(isAction).map(normalizeAction) : []
  } catch {
    return []
  }
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
    case "create_component":
      return {
        verb: "Criar componente",
        target: action.name,
        details: [
          `quantidade ${action.quantity ?? 1}`,
          `R$ ${(action.unitPrice ?? 0).toFixed(2)}`,
          action.requirementCode ? `requisito ${action.requirementCode}` : "",
        ].filter(Boolean),
      }
    case "create_task":
      return {
        verb: "Criar tarefa",
        target: action.title,
        details: [
          action.columnName ?? "Backlog",
          `prioridade ${action.priority ?? "Média"}`,
          action.assignee ? `responsável ${action.assignee}` : "",
          action.dueDate ? `prazo ${action.dueDate}` : "",
          action.requirementCode ? `requisito ${action.requirementCode}` : "",
          action.featureName ? `func. ${action.featureName}` : "",
        ].filter(Boolean),
      }
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
    columns: kanbanRes.ok ? kanban.columns : [],
    tasks: kanbanRes.ok ? kanban.tasks : [],
  }
}

const norm = (v: string) => v.trim().toLowerCase()

async function call(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.ok) return null
  const data = await res.json().catch(() => ({}))
  return data.error || `Falha HTTP ${res.status}`
}

/**
 * Executa as ações confirmadas pelo usuário, uma a uma, e devolve o resultado de cada uma.
 * Nunca é chamada automaticamente: só a partir do botão de confirmação.
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
  const featIdByName = (name?: string) =>
    name ? refs.features.find((f) => norm(f.name) === norm(name))?.id : undefined
  const colIdByName = (name?: string) =>
    name ? refs.columns.find((c) => norm(c.name) === norm(name))?.id : undefined
  const taskByTitle = (title: string) =>
    refs.tasks.find((t) => norm(t.title) === norm(title)) ??
    refs.tasks.find((t) => norm(t.title).includes(norm(title)))

  for (const action of actions) {
    const { verb, target } = describeAction(action)
    let error: string | null = null

    try {
      switch (action.type) {
        case "create_requirement":
          error = await call(`${base}/requirements`, "POST", {
            description: action.description,
            category: action.category ?? "Funcional",
            priority: action.priority ?? "Média",
            status: action.status,
            level: action.level,
          })
          break

        case "update_requirement": {
          const id = reqIdByCode(action.code)
          if (!id) { error = `Requisito ${action.code} não encontrado`; break }
          error = await call(`${base}/requirements/${id}`, "PATCH", {
            description: action.description,
            category: action.category,
            priority: action.priority,
            status: action.status,
            level: action.level,
          })
          break
        }

        case "delete_requirement": {
          const id = reqIdByCode(action.code)
          if (!id) { error = `Requisito ${action.code} não encontrado`; break }
          error = await call(`${base}/requirements/${id}`, "DELETE")
          break
        }

        case "create_feature":
          error = await call(`${base}/features`, "POST", {
            name: action.name,
            description: action.description,
            status: action.status,
            requirementId: reqIdByCode(action.requirementCode) ?? null,
          })
          break

        case "create_component":
          error = await call(`${base}/components`, "POST", {
            name: action.name,
            description: action.description,
            quantity: action.quantity ?? 1,
            unitPrice: action.unitPrice ?? 0,
            requirementId: reqIdByCode(action.requirementCode) ?? null,
          })
          break

        case "create_task":
          error = await call(`${base}/tasks`, "POST", {
            title: action.title,
            description: action.description,
            priority: action.priority,
            assignee: action.assignee,
            dueDate: action.dueDate,
            columnId: colIdByName(action.columnName),
            requirementId: reqIdByCode(action.requirementCode) ?? null,
            featureId: featIdByName(action.featureName) ?? null,
          })
          break

        case "move_task": {
          const task = taskByTitle(action.title)
          if (!task) { error = `Tarefa "${action.title}" não encontrada`; break }
          const columnId = colIdByName(action.columnName)
          if (!columnId) { error = `Coluna "${action.columnName}" não encontrada`; break }
          error = await call(`${base}/tasks/${task.id}`, "PATCH", { columnId })
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
