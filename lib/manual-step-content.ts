import type { ProjectStep } from "@/lib/project-steps"

export const MANUAL_STEP_CONTENT: Record<
  ProjectStep,
  { title: string; description: string }
> = {
  requisitos: {
    title: "Defina os requisitos",
    description:
      "Opcionais nesta etapa. Ajudam a rastrear decisões e dão mais contexto para a IA.",
  },
  funcionalidades: {
    title: "Organize as funcionalidades",
    description: "",
  },
  componentes: {
    title: "Escolha os componentes",
    description: "Peças físicas usadas para implementar as funcionalidades.",
  },
  custos: {
    title: "Revise os custos",
    description: "",
  },
  finalizar: {
    title: "Finalizar projeto",
    description: "",
  },
}
