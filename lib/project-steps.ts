import type { LucideIcon } from "lucide-react"
import {
  CircleCheckIcon,
  ClipboardListIcon,
  CpuIcon,
  LayoutGridIcon,
  WalletIcon,
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
    subtitle: "Transforme os requisitos em capacidades concretas.",
    completedSubtitle: "Funcionalidades definidas.",
    icon: LayoutGridIcon,
  },
  {
    key: "componentes",
    label: "Componentes",
    subtitle: "Escolha os componentes físicos necessários.",
    completedSubtitle: "Componentes planejados.",
    icon: CpuIcon,
  },
  {
    key: "custos",
    label: "Custos",
    subtitle: "Veja o custo total estimado do projeto.",
    completedSubtitle: "Custo estimado.",
    icon: WalletIcon,
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

export type StepStatus = "completed" | "current" | "upcoming" | "skipped"

export interface StepRailContext {
  requirementsCount?: number
  requirementsSkipped?: boolean
}

export function getStepStatus(
  stepIndex: number,
  currentIndex: number,
  context?: StepRailContext
): StepStatus {
  const step = PROJECT_STEPS[stepIndex]
  const isRequisitos = step.key === "requisitos"

  if (
    isRequisitos &&
    context?.requirementsSkipped &&
    (context.requirementsCount ?? 0) === 0 &&
    stepIndex < currentIndex
  ) {
    return "skipped"
  }

  if (stepIndex < currentIndex) {
    if (
      isRequisitos &&
      (context?.requirementsCount ?? 0) === 0 &&
      context?.requirementsSkipped
    ) {
      return "skipped"
    }
    return "completed"
  }
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
