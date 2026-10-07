import { tursoDb } from "./turso-db"

// Regras de requisito compartilhadas pelas rotas da tela e pelo servidor MCP.

export const REQUIREMENT_CATEGORY_PREFIX: Record<string, string> = {
  Funcional: "RF",
  "Não Funcional": "RNF",
}

export const REQUIREMENT_CATEGORIES = Object.keys(REQUIREMENT_CATEGORY_PREFIX)
export const REQUIREMENT_PRIORITIES = ["Alta", "Média", "Baixa"]
export const REQUIREMENT_STATUSES = ["Em Aberto", "Validado", "Descartado"]
export const REQUIREMENT_LEVELS = ["Sistema", "Subsistema", "Componente"]

/** Próximo código livre da categoria: com RF01 a RF07, o novo é RF08. */
export async function nextRequirementCode(projectId: string, category: string) {
  const prefix = REQUIREMENT_CATEGORY_PREFIX[category]
  const existing = await tursoDb.requirement.findMany({
    where: { projectId, category },
    select: { code: true },
  })

  const max = existing.reduce((currentMax, r) => {
    const n = parseInt(r.code.slice(prefix.length), 10)
    return Number.isNaN(n) ? currentMax : Math.max(currentMax, n)
  }, 0)

  return `${prefix}${String(max + 1).padStart(2, "0")}`
}
