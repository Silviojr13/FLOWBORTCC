import {
  CircleCheckIcon,
  CircleDashedIcon,
  LoaderCircleIcon,
  type LucideIcon,
} from "lucide-react"
import type { FeatureStatus } from "@/lib/feature-status"

export interface FeatureStatusDisplay {
  label: FeatureStatus
  icon: LucideIcon
  badgeClass: string
  textClass: string
  columnAccent: string
  selectAccent: string
  cardClass: string
}

export const FEATURE_STATUS_DISPLAY: Record<FeatureStatus, FeatureStatusDisplay> = {
  Planejada: {
    label: "Planejada",
    icon: CircleDashedIcon,
    badgeClass:
      "border-primary/25 bg-primary/5 text-primary dark:border-primary/30 dark:bg-primary/10",
    textClass: "text-primary",
    columnAccent: "border-t-2 border-t-primary/50",
    selectAccent: "border-primary/20",
    cardClass: "border-l-[3px] border-l-primary/40",
  },
  "Em desenvolvimento": {
    label: "Em desenvolvimento",
    icon: LoaderCircleIcon,
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    textClass: "text-amber-800 dark:text-amber-300",
    columnAccent: "border-t-2 border-t-amber-500/60",
    selectAccent: "border-amber-200/60 dark:border-amber-800/50",
    cardClass:
      "border-l-[3px] border-l-amber-500/70 bg-amber-50/30 dark:bg-amber-950/25",
  },
  Concluída: {
    label: "Concluída",
    icon: CircleCheckIcon,
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    textClass: "text-emerald-700 dark:text-emerald-300",
    columnAccent: "border-t-2 border-t-emerald-500/60",
    selectAccent: "border-emerald-200/60 dark:border-emerald-800/50",
    cardClass:
      "border-l-[3px] border-l-emerald-500/70 bg-emerald-50/30 dark:bg-emerald-950/25",
  },
}

export function getFeatureStatusDisplay(status: FeatureStatus): FeatureStatusDisplay {
  return FEATURE_STATUS_DISPLAY[status]
}
