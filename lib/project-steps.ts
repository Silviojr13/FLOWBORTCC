// Etapas da criação de um projeto, na ordem dos botões Voltar/Continuar.
export const PROJECT_STEPS = [
  { key: "requisitos", label: "Requisitos" },
  { key: "funcionalidades", label: "Funcionalidades" },
  { key: "componentes", label: "Componentes" },
  { key: "custos", label: "Custos" },
  { key: "finalizar", label: "Finalizar" },
] as const

export type ProjectStep = (typeof PROJECT_STEPS)[number]["key"]

export function getCurrentStepIndex(currentStep: ProjectStep): number {
  const index = PROJECT_STEPS.findIndex((step) => step.key === currentStep)
  return index === -1 ? 0 : index
}
