// Recursos do projeto: o que a organização usa para construir o produto (pessoas,
// equipamentos, software e serviços, espaços). Compartilhado entre API, telas e relatório.
//
// Componente × recurso: o componente vai dentro do produto (sensor, placa, licença
// embarcada); o recurso é usado para construí-lo e continua com a organização depois.

export const RESOURCE_TYPES = ["pessoa", "equipamento", "software", "espaco", "outro"] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  pessoa: "Pessoas",
  equipamento: "Equipamentos",
  software: "Software e serviços",
  espaco: "Espaços",
  outro: "Outros",
}

export const RESOURCE_TYPE_HINTS: Record<ResourceType, string> = {
  pessoa: "Ex.: engenheiro de firmware, designer, consultor",
  equipamento: "Ex.: notebook, osciloscópio, impressora 3D",
  software: "Ex.: licença de CAD, hospedagem em nuvem, API paga",
  espaco: "Ex.: laboratório, bancada, coworking",
  outro: "Ex.: viagens, treinamentos, frete",
}

export const RESOURCE_AVAILABILITY = ["disponivel", "adquirir"] as const
export type ResourceAvailability = (typeof RESOURCE_AVAILABILITY)[number]

export const RESOURCE_AVAILABILITY_LABELS: Record<ResourceAvailability, string> = {
  disponivel: "Já disponível",
  adquirir: "A adquirir",
}

export const RESOURCE_COST_MODELS = ["hora", "mes", "unico"] as const
export type ResourceCostModel = (typeof RESOURCE_COST_MODELS)[number]

export const RESOURCE_COST_MODEL_LABELS: Record<ResourceCostModel, string> = {
  hora: "Por hora",
  mes: "Por mês",
  unico: "Valor único",
}

/** O que a quantidade representa em cada forma de cobrança. */
export const RESOURCE_QUANTITY_LABELS: Record<ResourceCostModel, string> = {
  hora: "Horas",
  mes: "Meses",
  unico: "Unidades",
}

/** Forma de cobrança mais comum para cada tipo, sugerida ao cadastrar. */
export const DEFAULT_COST_MODEL: Record<ResourceType, ResourceCostModel> = {
  pessoa: "hora",
  equipamento: "unico",
  software: "mes",
  espaco: "mes",
  outro: "unico",
}

export const COMPONENT_DOMAINS = ["Hardware", "Software"] as const
export type ComponentDomain = (typeof COMPONENT_DOMAINS)[number]

export function isComponentDomain(value: unknown): value is ComponentDomain {
  return typeof value === "string" && (COMPONENT_DOMAINS as readonly string[]).includes(value)
}

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && (RESOURCE_TYPES as readonly string[]).includes(value)
}

export function isResourceAvailability(value: unknown): value is ResourceAvailability {
  return typeof value === "string" && (RESOURCE_AVAILABILITY as readonly string[]).includes(value)
}

export function isResourceCostModel(value: unknown): value is ResourceCostModel {
  return typeof value === "string" && (RESOURCE_COST_MODELS as readonly string[]).includes(value)
}

export interface Resource {
  id: string
  name: string
  description: string | null
  type: ResourceType
  availability: ResourceAvailability
  costModel: ResourceCostModel
  unitCost: number
  quantity: number
  requirementId: string | null
  projectId: string
}

export function resourceCost(r: { unitCost: number; quantity: number }) {
  return r.unitCost * r.quantity
}

/** "R$ 85,00/h × 120 h", para tabelas e relatório. */
export function describeResourceCost(
  r: { unitCost: number; quantity: number; costModel: string },
  format: (value: number) => string
) {
  const qty = Number.isInteger(r.quantity) ? String(r.quantity) : r.quantity.toLocaleString("pt-BR")
  switch (r.costModel) {
    case "hora":
      return `${format(r.unitCost)}/h × ${qty} h`
    case "mes":
      return `${format(r.unitCost)}/mês × ${qty} ${r.quantity === 1 ? "mês" : "meses"}`
    default:
      return r.quantity === 1 ? format(r.unitCost) : `${format(r.unitCost)} × ${qty}`
  }
}

export interface BudgetBreakdown {
  componentsHardware: number
  componentsSoftware: number
  resourcesByType: Record<ResourceType, number>
  /** Recursos que a organização já tem: custo de uso, não exige compra. */
  resourcesAvailable: number
  /** Componentes + recursos a adquirir: o que de fato precisa ser desembolsado. */
  toSpend: number
  total: number
}

export function buildBudget(
  components: { quantity: number; unitPrice: number; domain?: string | null }[],
  resources: { unitCost: number; quantity: number; type: string; availability: string }[]
): BudgetBreakdown {
  const resourcesByType = Object.fromEntries(RESOURCE_TYPES.map((t) => [t, 0])) as Record<ResourceType, number>
  let componentsHardware = 0
  let componentsSoftware = 0
  for (const c of components) {
    const value = c.quantity * c.unitPrice
    if (c.domain === "Software") componentsSoftware += value
    else componentsHardware += value
  }

  let resourcesAvailable = 0
  let resourcesToAcquire = 0
  for (const r of resources) {
    const value = resourceCost(r)
    const type = isResourceType(r.type) ? r.type : "outro"
    resourcesByType[type] += value
    if (r.availability === "adquirir") resourcesToAcquire += value
    else resourcesAvailable += value
  }

  const componentsTotal = componentsHardware + componentsSoftware
  return {
    componentsHardware,
    componentsSoftware,
    resourcesByType,
    resourcesAvailable,
    toSpend: componentsTotal + resourcesToAcquire,
    total: componentsTotal + resourcesAvailable + resourcesToAcquire,
  }
}
