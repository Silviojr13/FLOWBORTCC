import { Badge } from "@/components/ui/badge"
import { getFeatureStatusDisplay } from "@/lib/feature-status-display"
import type { FeatureStatus } from "@/lib/feature-status"
import { cn } from "@/lib/utils"

export function FeatureStatusBadge({
  status,
  className,
}: {
  status: FeatureStatus
  className?: string
}) {
  const display = getFeatureStatusDisplay(status)
  const Icon = display.icon

  return (
    <Badge variant="outline" className={cn("shrink-0 gap-1", display.badgeClass, className)}>
      <Icon className="size-3" aria-hidden />
      {display.label}
    </Badge>
  )
}
