"use client"

import {
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getCurrentStepIndex,
  getStepStatus,
  PROJECT_STEPS,
  type ProjectStep,
  type StepStatus,
} from "@/lib/project-steps"

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return <CheckCircle2Icon className="size-4 shrink-0 text-emerald-400" aria-hidden />
  }

  if (status === "current") {
    return <CircleDotIcon className="size-4 shrink-0 text-primary" aria-hidden />
  }

  return (
    <CircleIcon
      className="size-4 shrink-0 text-muted-foreground/40"
      aria-hidden
    />
  )
}

function StepCard({
  step,
  status,
  isLast,
}: {
  step: (typeof PROJECT_STEPS)[number]
  status: StepStatus
  isLast: boolean
}) {
  const Icon = step.icon
  const subtitle =
    status === "completed" ? step.completedSubtitle : step.subtitle

  return (
    <li className="relative flex gap-3">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            "absolute left-[1.125rem] top-10 bottom-0 w-px -translate-x-1/2",
            status === "completed" ? "bg-emerald-500/35" : "bg-white/8"
          )}
        />
      )}

      <div
        className={cn(
          "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
          status === "current" &&
            "border-primary/40 bg-primary/15 text-primary shadow-[0_0_16px_-6px_oklch(0.65_0.2_250/40%)]",
          status === "completed" &&
            "border-emerald-500/35 bg-emerald-500/10 text-emerald-400",
          status === "upcoming" &&
            "border-white/6 bg-white/3 text-muted-foreground/50"
        )}
      >
        <Icon className="size-4" />
      </div>

      <div
        aria-current={status === "current" ? "step" : undefined}
        aria-disabled={status === "upcoming" ? true : undefined}
        className={cn(
          "mb-4 min-w-0 flex-1 rounded-xl border px-3.5 py-3 transition-colors",
          status === "current" &&
            "border-primary/35 bg-primary/8 shadow-[0_0_24px_-10px_oklch(0.65_0.2_250/35%)]",
          status === "completed" &&
            "border-emerald-500/25 bg-emerald-500/6",
          status === "upcoming" &&
            "border-white/5 bg-white/2 text-muted-foreground/70"
        )}
      >
        <div className="flex items-start gap-2">
          <StepStatusIcon status={status} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p
                className={cn(
                  "text-sm font-medium leading-snug",
                  status === "current" && "text-primary",
                  status === "completed" && "text-emerald-400",
                  status === "upcoming" && "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
              {status === "current" && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  Etapa atual
                </span>
              )}
            </div>
            <p
              className={cn(
                "mt-1 text-xs leading-relaxed",
                status === "current" && "text-foreground/80",
                status === "completed" && "text-emerald-400/75",
                status === "upcoming" && "text-muted-foreground/60"
              )}
            >
              {subtitle}
            </p>
          </div>
        </div>
      </div>
    </li>
  )
}

function ProjectStepRailDesktop({ currentStep }: { currentStep: ProjectStep }) {
  const currentIndex = getCurrentStepIndex(currentStep)

  return (
    <nav aria-label="Progresso do projeto" className="w-full">
      <ol className="flex flex-col">
        {PROJECT_STEPS.map((step, index) => (
          <StepCard
            key={step.key}
            step={step}
            status={getStepStatus(index, currentIndex)}
            isLast={index === PROJECT_STEPS.length - 1}
          />
        ))}
      </ol>
    </nav>
  )
}

function ProjectStepRailCompact({ currentStep }: { currentStep: ProjectStep }) {
  const currentIndex = getCurrentStepIndex(currentStep)
  const current = PROJECT_STEPS[currentIndex]

  return (
    <nav
      aria-label="Progresso do projeto"
      className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 backdrop-blur-sm"
    >
      <p className="text-xs text-muted-foreground">
        Etapa {currentIndex + 1} de {PROJECT_STEPS.length}
      </p>
      <p className="mt-1 text-sm font-medium text-primary">{current.label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{current.subtitle}</p>

      <div className="mt-3 flex gap-1.5" aria-hidden>
        {PROJECT_STEPS.map((step, index) => {
          const status = getStepStatus(index, currentIndex)

          return (
            <div
              key={step.key}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                status === "completed" && "bg-emerald-500/70",
                status === "current" && "bg-primary",
                status === "upcoming" && "bg-white/10"
              )}
            />
          )
        })}
      </div>
    </nav>
  )
}

export function ProjectStepRail({
  currentStep,
  className,
  variant = "rail",
}: {
  currentStep: ProjectStep
  className?: string
  variant?: "rail" | "compact"
}) {
  return (
    <aside className={cn(className)}>
      {variant === "rail" ? (
        <ProjectStepRailDesktop currentStep={currentStep} />
      ) : (
        <ProjectStepRailCompact currentStep={currentStep} />
      )}
    </aside>
  )
}
