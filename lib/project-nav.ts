import type { LucideIcon } from "lucide-react"
import {
  BoxIcon,
  CalendarRangeIcon,
  ClipboardListIcon,
  Columns3Icon,
  FileChartColumnIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react"

export type ProjectModuleKey =
  | "overview"
  | "kanban"
  | "sprints"
  | "report"
  | "features"
  | "components"
  | "resources"
  | "requirements"
  | "diagrams"

export type ProjectModule = {
  key: ProjectModuleKey
  label: string
  description: string
  icon: LucideIcon
  href: (projectId: string) => string
}

export const PROJECT_MODULES: ProjectModule[] = [
  {
    key: "overview",
    label: "Visão geral",
    description: "Resumo e atalhos do projeto.",
    icon: LayoutDashboardIcon,
    href: (projectId) => `/dashboard/projects/${projectId}`,
  },
  {
    key: "kanban",
    label: "Kanban",
    description: "Acompanhe funcionalidades e tarefas.",
    icon: Columns3Icon,
    href: (projectId) => `/dashboard/projects/${projectId}/kanban`,
  },
  {
    key: "sprints",
    label: "Sprints",
    description: "Organize o trabalho em períodos curtos.",
    icon: CalendarRangeIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/sprints`,
  },
  {
    key: "report",
    label: "Relatórios",
    description: "Veja a evolução do projeto.",
    icon: FileChartColumnIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/report`,
  },
  {
    key: "features",
    label: "Funcionalidades",
    description: "Gerencie as capacidades do projeto.",
    icon: SparklesIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/features`,
  },
  {
    key: "components",
    label: "Componentes",
    description: "Peças do projeto e custo estimado.",
    icon: BoxIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/components-costs`,
  },
  {
    key: "resources",
    label: "Recursos",
    description: "Pessoas, equipamentos e custos do projeto.",
    icon: WalletIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/resources`,
  },
  {
    key: "requirements",
    label: "Requisitos",
    description: "Defina o que o projeto precisa atender.",
    icon: ClipboardListIcon,
    href: (projectId) => `/dashboard/projects/${projectId}?step=requisitos`,
  },
  {
    key: "diagrams",
    label: "Diagramas",
    description: "C4, modelo relacional e UML do projeto.",
    icon: NetworkIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/diagrams`,
  },
]

export const PROJECT_MODULE_GROUPS = [
  {
    id: "tracking",
    label: "Acompanhamento",
    keys: ["overview", "kanban", "sprints", "report"] as const,
  },
  {
    id: "structure",
    label: "Estrutura do projeto",
    keys: ["features", "components", "resources", "requirements", "diagrams"] as const,
  },
]

export const PROJECT_PRIMARY_SHORTCUTS = PROJECT_MODULES.filter((item) =>
  item.key === "kanban" || item.key === "sprints" || item.key === "report"
)

export const PROJECT_SECONDARY_SHORTCUTS = PROJECT_MODULES.filter((item) =>
  item.key === "features" ||
  item.key === "components" ||
  item.key === "resources" ||
  item.key === "requirements" ||
  item.key === "diagrams"
)

const WIZARD_CRUMB_LABELS: Record<string, string> = {
  requisitos: "Requisitos",
  funcionalidades: "Funcionalidades",
  componentes: "Componentes",
  custos: "Custos",
  finalizar: "Finalizar",
}

export function extractActiveProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/projects\/([^/]+)/)
  if (!match || match[1] === "new") return null
  return match[1]
}

function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getProjectModuleKey(
  pathname: string,
  projectId: string,
  step: string | null
): ProjectModuleKey | null {
  const base = `/dashboard/projects/${projectId}`

  if (pathname === base) {
    if (step === "requisitos") return "requirements"
    if (step) return null
    return "overview"
  }

  if (matchesPath(pathname, `${base}/kanban`)) return "kanban"
  if (matchesPath(pathname, `${base}/sprints`)) return "sprints"
  if (matchesPath(pathname, `${base}/report`)) return "report"
  if (matchesPath(pathname, `${base}/features`)) return "features"
  if (matchesPath(pathname, `${base}/components-costs`)) return "components"
  if (matchesPath(pathname, `${base}/resources`)) return "resources"
  if (matchesPath(pathname, `${base}/diagrams`)) return "diagrams"
  return null
}

export function getProjectModule(key: ProjectModuleKey) {
  return PROJECT_MODULES.find((item) => item.key === key) ?? null
}

export function getProjectCrumbLabel(
  pathname: string,
  projectId: string,
  step: string | null
): string | null {
  const key = getProjectModuleKey(pathname, projectId, step)
  if (key === "overview") return null
  if (key) return getProjectModule(key)?.label ?? null

  const base = `/dashboard/projects/${projectId}`
  if (pathname === base && step) return WIZARD_CRUMB_LABELS[step] ?? "Projeto"
  if (pathname.startsWith(`${base}/`)) return "Projeto"
  return null
}

export function isProjectOverview(
  pathname: string,
  projectId: string,
  step: string | null
) {
  return pathname === `/dashboard/projects/${projectId}` && !step
}
