import type { LucideIcon } from "lucide-react"
import {
  BoxIcon,
  BrainCircuitIcon,
  CalendarRangeIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CodeXmlIcon,
  Columns3Icon,
  FileTextIcon,
  FileChartColumnIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

export type ProjectModuleKey =
  | "overview"
  | "kanban"
  | "sprints"
  | "report"
  | "development"
  | "council"
  | "features"
  | "components"
  | "resources"
  | "requirements"
  | "diagrams"
  | "docs"
  | "evaluation"
  | "sharing"

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
    key: "development",
    label: "Desenvolvimento",
    description: "O que o Claude Code fez e relatou no projeto.",
    icon: CodeXmlIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/development`,
  },
  {
    key: "council",
    label: "Conselho de IAs",
    description: "IAs com cargos analisam o projeto e propõem os próximos passos.",
    icon: BrainCircuitIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/council`,
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
    href: (projectId) => `/dashboard/projects/${projectId}/requirements`,
  },
  {
    key: "diagrams",
    label: "Diagramas",
    description: "C4, modelo relacional e UML do projeto.",
    icon: NetworkIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/diagrams`,
  },
  {
    key: "docs",
    label: "Documentação",
    description: "Documentos de engenharia nas normas ISO/IEC/IEEE.",
    icon: FileTextIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/docs`,
  },
  {
    key: "evaluation",
    label: "Avaliação",
    description: "Avaliação de usabilidade com participantes: convites, tarefas e nota SUS.",
    icon: ClipboardCheckIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/avaliacao`,
  },
  {
    key: "sharing",
    label: "Compartilhamento",
    description: "Quem participa do projeto e com qual cargo.",
    icon: UsersIcon,
    href: (projectId) => `/dashboard/projects/${projectId}/sharing`,
  },
]

export const PROJECT_MODULE_GROUPS = [
  {
    id: "tracking",
    label: "Acompanhamento",
    keys: ["overview", "kanban", "sprints", "report", "development", "council"] as const,
  },
  {
    id: "structure",
    label: "Estrutura do projeto",
    keys: ["features", "components", "resources", "requirements", "diagrams", "docs"] as const,
  },
  {
    id: "team",
    label: "Equipe",
    keys: ["sharing", "evaluation"] as const,
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
  item.key === "diagrams" ||
  item.key === "docs"
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

  // Com ?step= a página é o assistente de criação, que não corresponde a nenhuma aba.
  if (pathname === base) return step ? null : "overview"

  if (matchesPath(pathname, `${base}/kanban`)) return "kanban"
  if (matchesPath(pathname, `${base}/sprints`)) return "sprints"
  if (matchesPath(pathname, `${base}/report`)) return "report"
  if (matchesPath(pathname, `${base}/development`)) return "development"
  if (matchesPath(pathname, `${base}/council`)) return "council"
  if (matchesPath(pathname, `${base}/features`)) return "features"
  if (matchesPath(pathname, `${base}/components-costs`)) return "components"
  if (matchesPath(pathname, `${base}/resources`)) return "resources"
  if (matchesPath(pathname, `${base}/requirements`)) return "requirements"
  if (matchesPath(pathname, `${base}/diagrams`)) return "diagrams"
  if (matchesPath(pathname, `${base}/docs`)) return "docs"
  if (matchesPath(pathname, `${base}/sharing`)) return "sharing"
  if (matchesPath(pathname, `${base}/avaliacao`)) return "evaluation"
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
