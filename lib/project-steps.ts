import type { LucideIcon } from "lucide-react"
import {
  CircleCheckIcon,
  ClipboardListIcon,
  CpuIcon,
  LayoutGridIcon,
} from "lucide-react"

export const PROJECT_STEPS = [
  {
    key: "requisitos",
    label: "Requisitos",
    subtitle: "Defina o que o projeto precisa atender.",
    completedSubtitle: "Definição concluída.",
    icon: ClipboardListIcon,
  },
  {
    key: "funcionalidades",
    label: "Funcionalidades",
    subtitle: "Organize as capacidades do projeto.",
    completedSubtitle: "Capacidades definidas.",
    icon: LayoutGridIcon,
  },
  {
    key: "componentes",
    label: "Componentes e Custos",
    subtitle: "Planeje os componentes necessários.",
    completedSubtitle: "Componentes planejados.",
    icon: CpuIcon,
  },
  {
    key: "finalizar",
    label: "Finalizar",
    subtitle: "Revise e conclua a criação do projeto.",
    completedSubtitle: "Projeto concluído.",
    icon: CircleCheckIcon,
  },
] as const

export type ProjectStep = (typeof PROJECT_STEPS)[number]["key"]

export type StepStatus = "completed" | "current" | "upcoming"

export function getStepStatus(
  stepIndex: number,
  currentIndex: number
): StepStatus {
  if (stepIndex < currentIndex) return "completed"
  if (stepIndex === currentIndex) return "current"
  return "upcoming"
}

export function getCurrentStepIndex(currentStep: ProjectStep): number {
  const index = PROJECT_STEPS.findIndex((step) => step.key === currentStep)
  return index === -1 ? 0 : index
}

export type ProjectStepDefinition = (typeof PROJECT_STEPS)[number] & {
  icon: LucideIcon
}
