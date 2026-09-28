"use client"

import { toast } from "sonner"

/** Espelha ProjectEffect de lib/project-events.ts, do lado do cliente. */
export interface ProjectEffect {
  kind:
    | "tasks_of_discarded_requirement"
    | "tasks_of_restored_requirement"
    | "requirement_fully_covered"
    | "links_removed"
  message: string
  level: "info" | "warning" | "success"
  data?: Record<string, unknown>
}

export interface EffectHandlers {
  /** Permite oferecer "Validar requisito" quando todas as tarefas dele são concluídas. */
  onValidateRequirement?: (requirementId: string, code: string) => void
}

/**
 * Exibe as repercussões devolvidas pelas rotas após uma alteração — é o que torna visível,
 * para o usuário, que mexer em um módulo afetou os outros.
 */
export function showProjectEffects(
  effects: ProjectEffect[] | undefined,
  handlers: EffectHandlers = {}
) {
  if (!effects?.length) return

  for (const effect of effects) {
    if (
      effect.kind === "requirement_fully_covered" &&
      handlers.onValidateRequirement &&
      typeof effect.data?.requirementId === "string" &&
      typeof effect.data?.requirementCode === "string"
    ) {
      const id = effect.data.requirementId as string
      const code = effect.data.requirementCode as string
      toast.success(effect.message, {
        duration: 8000,
        action: {
          label: "Validar",
          onClick: () => handlers.onValidateRequirement?.(id, code),
        },
      })
      continue
    }

    const show =
      effect.level === "warning"
        ? toast.warning
        : effect.level === "success"
          ? toast.success
          : toast.info

    show(effect.message, { duration: 6000 })
  }
}
