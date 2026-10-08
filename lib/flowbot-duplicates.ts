import type { FlowbotAction } from "./flowbot-actions"

/**
 * Avisos de repetição no card de confirmação: antes de criar, compara o que a IA propõe com o
 * que o projeto já tem (inclusive tarefas concluídas). A IA nem sempre vê o projeto inteiro
 * (o contexto é resumido para caber no limite dela), então a conferência é feita aqui, com
 * os dados reais.
 */

export interface ExistingTask {
  title: string
  description?: string | null
  requirement?: { code: string } | null
}

export interface ExistingProjectItems {
  tasks: ExistingTask[]
  features: { name: string }[]
  requirements: { code: string; description: string }[]
}

export interface DuplicateHint {
  /** "duplicate": quase certamente repete algo (vem desmarcado); "related": vale conferir. */
  level: "duplicate" | "related"
  message: string
}

// Palavras que não dizem o que a tarefa é.
const STOPWORDS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "um", "uma",
  "para", "por", "com", "sem", "ao", "aos", "que", "se", "seu", "sua",
  "implementar", "criar", "fazer", "adicionar", "desenvolver", "construir", "integrar", "configurar",
  "ajustar", "definir", "tela", "logica", "funcao", "funcionalidade", "sistema", "projeto", "experiencia",
])

function words(text: string): Set<string> {
  const plain = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  return new Set(plain.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)))
}

/** Quanto dois textos falam da mesma coisa: 0 a 1 (palavras em comum sobre o menor). */
function overlap(a: string, b: string): number {
  const wa = words(a)
  const wb = words(b)
  if (wa.size === 0 || wb.size === 0) return 0
  let common = 0
  for (const w of wa) if (wb.has(w)) common++
  return common / Math.min(wa.size, wb.size)
}

function quote(text: string): string {
  const short = text.length > 60 ? text.slice(0, 59) + "…" : text
  return `"${short}"`
}

type ProposedTask = Extract<FlowbotAction, { type: "create_task" }>

/** Quão parecida a tarefa proposta é com uma existente, e quanto precisa para contar como repetida. */
function taskSimilarity(action: ProposedTask, task: ExistingTask, code: string | undefined) {
  const sameRequirement = Boolean(code && task.requirement?.code === code)
  const byTitle = overlap(action.title, task.title)
  // Descrição só pesa com o mesmo requisito: sozinha, gera falso alarme.
  const byText = sameRequirement
    ? overlap(`${action.title} ${action.description ?? ""}`, `${task.title} ${task.description ?? ""}`)
    : 0
  return { score: Math.max(byTitle, byText), needed: sameRequirement ? 0.5 : 0.75 }
}

function taskHint(action: ProposedTask, existing: ExistingTask[]): DuplicateHint | null {
  const code = action.requirementCode?.toUpperCase()
  let best: { task: ExistingTask; score: number } | null = null
  for (const task of existing) {
    const { score, needed } = taskSimilarity(action, task, code)
    if (score >= needed && (!best || score > best.score)) best = { task, score }
  }
  if (best) return { level: "duplicate", message: `Parece repetir a tarefa ${quote(best.task.title)}, que já existe.` }

  if (code) {
    const sameReq = existing.filter((t) => t.requirement?.code === code)
    if (sameReq.length > 0) {
      const names = sameReq.slice(0, 3).map((t) => quote(t.title)).join(", ")
      return { level: "related", message: `${code} já tem ${sameReq.length} tarefa(s): ${names}${sameReq.length > 3 ? "…" : ""}.` }
    }
  }
  return null
}

/** Um aviso por ação de criação que parece repetir o projeto; índice da ação → aviso. */
export function findDuplicateHints(actions: FlowbotAction[], existing: ExistingProjectItems): Map<number, DuplicateHint> {
  const hints = new Map<number, DuplicateHint>()
  actions.forEach((action, index) => {
    if (action.type === "create_task") {
      const hint = taskHint(action, existing.tasks)
      if (hint) hints.set(index, hint)
    } else if (action.type === "create_feature") {
      const same = existing.features.find((f) => overlap(action.name, f.name) >= 0.75)
      if (same) hints.set(index, { level: "duplicate", message: `Parece repetir a funcionalidade ${quote(same.name)}.` })
    } else if (action.type === "create_requirement") {
      const same = existing.requirements.find((r) => overlap(action.description, r.description) >= 0.7)
      if (same) hints.set(index, { level: "duplicate", message: `Parece repetir o ${same.code}: ${quote(same.description)}.` })
    }
  })
  return hints
}
