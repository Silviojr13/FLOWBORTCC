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
  Alta: { icon: AlertCircleIcon, className: "text-red-600 dark:text-red-400", label: "Alta" },
  Média: { icon: CircleDotIcon, className: "text-amber-600 dark:text-amber-400", label: "Média" },
  Baixa: { icon: MinusIcon, className: "text-muted-foreground", label: "Baixa" },
}

const STATUS_CONFIG: Record<
  Status,
  { icon: typeof CircleIcon; className: string; label: string }
> = {
  "Em Aberto": {
    icon: CircleIcon,
    className: "text-muted-foreground",
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
  "Não Funcional": { className: "text-muted-foreground" },
}

export function PriorityIndicator({ value }: { value: Priority }) {
  const config = PRIORITY_CONFIG[value]
  const Icon = config.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", config.className)}>
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
  const config = PRIORITY_CONFIG[value]
  const Icon = config.icon
  return (
    <span className="flex items-center gap-2">
      <Icon className={cn("size-3.5", config.className)} />
      {config.label}
    </span>
  )
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
