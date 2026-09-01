"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FEATURE_STATUSES, type FeatureStatus } from "@/lib/feature-status"
import { getFeatureStatusDisplay } from "@/lib/feature-status-display"
import { cn } from "@/lib/utils"

export function FeatureStatusSelect({
  value,
  onValueChange,
  disabled,
  className,
  size = "sm",
}: {
  value: FeatureStatus
  onValueChange: (status: FeatureStatus) => void
  disabled?: boolean
  className?: string
  size?: "sm" | "default"
}) {
  const current = getFeatureStatusDisplay(value)
  const CurrentIcon = current.icon

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as FeatureStatus)} disabled={disabled}>
      <SelectTrigger
        size={size}
        className={cn("w-full min-w-[10rem]", current.selectAccent, className)}
      >
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <CurrentIcon className={cn("size-3.5 shrink-0", current.textClass)} aria-hidden />
            <span>{current.label}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {FEATURE_STATUSES.map((status) => {
          const display = getFeatureStatusDisplay(status)
          const Icon = display.icon
          return (
            <SelectItem key={status} value={status}>
              <span className="flex items-center gap-2">
                <Icon className={cn("size-3.5 shrink-0", display.textClass)} aria-hidden />
                {display.label}
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
