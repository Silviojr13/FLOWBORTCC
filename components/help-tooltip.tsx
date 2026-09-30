"use client"

import { CircleHelpIcon } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export const HELP = {
  kanban:
    "Quadro visual que organiza as tarefas por estado de desenvolvimento.",
  sprint:
    "Período curto de trabalho usado para organizar um conjunto de tarefas.",
  feature:
    "Capacidade principal do projeto. O trabalho detalhado fica nas tarefas do Kanban.",
  priority: "Importância deste item em relação aos demais do projeto.",
  category:
    "Funcional (RF) define o que o sistema deve fazer. Não funcional (RNF) define qualidade ou restrições, como desempenho, segurança ou conectividade.",
  coverage: "Indica se alguma tarefa do Kanban está ligada a este requisito.",
  requirementCost:
    "Soma aproximada dos componentes vinculados a este requisito.",
  traceability:
    "Relação entre requisitos, funcionalidades, tarefas e outras decisões do projeto.",
  estimatedCost:
    "Valor aproximado calculado com base nos componentes e nos preços informados.",
  relatedRequirement: "Requisito que esta parte do projeto ajuda a atender.",
  uncovered: "Requisitos que ainda não têm nenhuma tarefa vinculada.",
  requirementLevel:
    "Granularidade do requisito: sistema, subsistema ou componente.",
  aiSuggestion:
    "Proposta gerada pela IA a partir dos requisitos e funcionalidades do projeto.",
} as const

export function HelpTooltip({
  label,
  content,
  className,
}: {
  label: string
  content: string
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground normal-case transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none print:hidden",
            className
          )}
          aria-label={`Ajuda: ${label}`}
        >
          <CircleHelpIcon className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="z-[70] max-w-64 items-start text-left leading-snug"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export function HelpLabel({
  children,
  label,
  content,
  className,
}: {
  children: React.ReactNode
  label: string
  content: string
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <HelpTooltip label={label} content={content} />
    </span>
  )
}
