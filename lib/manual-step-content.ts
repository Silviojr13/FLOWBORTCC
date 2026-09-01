import type { ProjectStep } from "@/lib/project-steps"

export const MANUAL_STEP_CONTENT: Record<
  ProjectStep,
  { title: string; description: string }
> = {
  requisitos: {
    title: "Defina os requisitos",
    description:
      "Registre o que o projeto precisa atender. Requisitos ajudam a estruturar e rastrear as decisões do projeto, mas você pode defini-los depois.",
  },
  funcionalidades: {
    title: "Organize as funcionalidades",
    description:
      "Defina as principais capacidades que serão desenvolvidas no projeto. Elas também formarão o seu quadro Kanban.",
  },
  componentes: {
    title: "Escolha os componentes",
    description:
      "Defina os componentes físicos necessários para implementar as funcionalidades do projeto.",
  },
  custos: {
    title: "Revise os custos",
    description:
      "Visualize o investimento estimado e identifique oportunidades para otimizar o orçamento.",
  },
  finalizar: {
    title: "Finalizar projeto",
    description: "Revise o que foi definido e conclua a criação do projeto.",
  },
}
