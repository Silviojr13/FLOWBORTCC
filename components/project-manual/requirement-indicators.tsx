import {
  AlertCircleIcon,
  CircleDotIcon,
  CircleIcon,
  MinusIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Priority = "Alta" | "Média" | "Baixa"
type Status = "Em Aberto" | "Validado" | "Descartado"
type Category = "Funcional" | "Não Funcional"

const PRIORITY_CONFIG: Record<
  Priority,
  { icon: typeof CircleIcon; className: string; label: string }
> = {
  Alta: {
    icon: AlertCircleIcon,
    className:
      "border border-red-200 bg-red-100 text-red-800 dark:border-red-900/80 dark:bg-red-950/80 dark:text-red-200",
    label: "Alta",
  },
  Média: {
    icon: CircleDotIcon,
    className:
      "border border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/80 dark:text-amber-200",
    label: "Média",
  },
  Baixa: {
    icon: MinusIcon,
    className:
      "border border-teal-200 bg-teal-100 text-teal-800 dark:border-teal-900/80 dark:bg-teal-950/80 dark:text-teal-200",
    label: "Baixa",
  },
}

const STATUS_CONFIG: Record<
  Status,
  { icon: typeof CircleIcon; className: string; label: string }
> = {
  "Em Aberto": {
    icon: CircleIcon,
    className: "text-primary",
    label: "Em Aberto",
  },
  Validado: {
    icon: CheckCircle2Icon,
    className: "text-emerald-600 dark:text-emerald-400",
    label: "Validado",
  },
  Descartado: {
    icon: XCircleIcon,
    className: "text-destructive",
    label: "Descartado",
  },
}

const CATEGORY_CONFIG: Record<Category, { className: string }> = {
  Funcional: { className: "text-primary" },
  "Não Funcional": { className: "text-teal-700 dark:text-teal-300" },
}

export function PriorityIndicator({ value }: { value: Priority }) {
  const config = PRIORITY_CONFIG[value]
  const Icon = config.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {config.label}
    </span>
  )
}

export function StatusIndicator({ value }: { value: Status }) {
  const config = STATUS_CONFIG[value]
  const Icon = config.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", config.className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {config.label}
    </span>
  )
}

export function CategoryIndicator({ value }: { value: Category }) {
  return (
    <span className={cn("text-sm", CATEGORY_CONFIG[value].className)}>{value}</span>
  )
}

export function PrioritySelectItem({ value }: { value: Priority }) {
  return <PriorityIndicator value={value} />
}

export function StatusSelectItem({ value }: { value: Status }) {
  const config = STATUS_CONFIG[value]
  const Icon = config.icon
  return (
    <span className="flex items-center gap-2">
      <Icon className={cn("size-3.5", config.className)} />
      {config.label}
    </span>
  )
}

export { PRIORITY_CONFIG, STATUS_CONFIG }

/**
 * Cobertura do requisito pelas tarefas do Kanban (integração Kanban → Requisitos).
 * Sem tarefa vinculada, sinaliza que o requisito está descoberto (RF02/RF14).
 */
export function CoverageIndicator({ total, done }: { total: number; done: number }) {
  if (total === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
        <AlertCircleIcon className="size-3.5 shrink-0" aria-hidden />
        Sem tarefa
      </span>
    )
  }

  const pct = Math.round((done / total) * 100)

  return (
    <span className="inline-flex items-center gap-2 text-sm" title={`${done} de ${total} tarefa(s) concluída(s)`}>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </span>
  )
}
