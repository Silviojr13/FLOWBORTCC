"use client"

import {
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  MinusCircleIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getCurrentStepIndex,
  getStepStatus,
  PROJECT_STEPS,
  type ProjectStep,
  type StepRailContext,
  type StepStatus,
} from "@/lib/project-steps"

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return (
      <CheckCircle2Icon
        className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-hidden
      />
    )
  }

  if (status === "current") {
    return <CircleDotIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
  }

  if (status === "skipped") {
    return (
      <MinusCircleIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    )
  }

  return (
    <CircleIcon className="size-3.5 shrink-0 text-muted-foreground/45" aria-hidden />
  )
}

function statusHint(status: StepStatus) {
  if (status === "current") return "Etapa atual"
  if (status === "completed") return "Concluído"
  if (status === "skipped") return "Não definido"
  return null
}

function StepItem({
  step,
  status,
  isLast,
}: {
  step: (typeof PROJECT_STEPS)[number]
  status: StepStatus
  isLast: boolean
}) {
  const hint = statusHint(status)

  return (
    <li className="relative flex gap-2">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            "absolute left-[0.6875rem] top-6 bottom-0 w-px -translate-x-1/2",
            status === "completed"
              ? "bg-emerald-200/80 dark:bg-emerald-800/60"
              : "bg-border/80"
          )}
        />
      )}

      <div className="relative z-10 flex w-3.5 shrink-0 justify-center pt-0.5">
        <StepStatusIcon status={status} />
      </div>

      <div
        aria-current={status === "current" ? "step" : undefined}
        className={cn(
          "mb-2 min-w-0 flex-1 rounded-md border px-2 py-1.5",
          status === "current" && "border-primary/30 bg-primary/5 dark:bg-primary/10",
          status === "completed" &&
            "border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20",
          status === "skipped" && "border-border/70 bg-muted/20",
          status === "upcoming" && "border-transparent bg-transparent"
        )}
      >
        <div className="flex items-center gap-1.5">
          <step.icon
            className={cn(
              "size-3 shrink-0",
              status === "current" && "text-primary",
              status === "completed" && "text-emerald-600 dark:text-emerald-400",
              status === "skipped" && "text-muted-foreground",
              status === "upcoming" && "text-muted-foreground/50"
            )}
            aria-hidden
          />
          <p
            className={cn(
              "text-xs font-medium leading-tight",
              status === "current" && "text-primary",
              status === "completed" && "text-emerald-700 dark:text-emerald-300",
              status === "skipped" && "text-muted-foreground",
              status === "upcoming" && "text-muted-foreground/70"
            )}
          >
            {step.label}
          </p>
        </div>
        {hint && (
          <p
            className={cn(
              "mt-0.5 pl-[1.125rem] text-[10px] leading-tight",
              status === "current" && "text-foreground/70",
              status === "completed" && "text-emerald-600/80 dark:text-emerald-400/80",
              status === "skipped" && "text-muted-foreground/80"
            )}
          >
            {hint}
          </p>
        )}
      </div>
    </li>
  )
}

function ProjectStepRailDesktop({
  currentStep,
  railContext,
}: {
  currentStep: ProjectStep
  railContext?: StepRailContext
}) {
  const currentIndex = getCurrentStepIndex(currentStep)

  return (
    <nav aria-label="Progresso do projeto" className="w-full">
      <ol className="flex flex-col">
        {PROJECT_STEPS.map((step, index) => (
          <StepItem
            key={step.key}
            step={step}
            status={getStepStatus(index, currentIndex, railContext)}
            isLast={index === PROJECT_STEPS.length - 1}
          />
        ))}
      </ol>
    </nav>
  )
}

function ProjectStepRailCompact({
  currentStep,
  railContext,
}: {
  currentStep: ProjectStep
  railContext?: StepRailContext
}) {
  const currentIndex = getCurrentStepIndex(currentStep)
  const current = PROJECT_STEPS[currentIndex]

  return (
    <nav
      aria-label="Progresso do projeto"
      className="rounded-lg border border-border bg-card/80 px-3 py-2.5"
    >
      <p className="text-[10px] text-muted-foreground">
        Etapa {currentIndex + 1} de {PROJECT_STEPS.length}
      </p>
      <p className="mt-0.5 text-sm font-medium text-primary">{current.label}</p>

      <div className="mt-2 flex gap-1" aria-hidden>
        {PROJECT_STEPS.map((step, index) => {
          const status = getStepStatus(index, currentIndex, railContext)

          return (
            <div
              key={step.key}
              className={cn(
                "h-0.5 flex-1 rounded-full transition-colors",
                status === "completed" && "bg-emerald-500 dark:bg-emerald-600",
                status === "current" && "bg-primary",
                status === "skipped" && "bg-muted-foreground/30",
                status === "upcoming" && "bg-muted"
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
  railContext,
}: {
  currentStep: ProjectStep
  className?: string
  variant?: "rail" | "compact"
  railContext?: StepRailContext
}) {
  return (
    <aside className={cn(className)}>
      {variant === "rail" ? (
        <ProjectStepRailDesktop
          currentStep={currentStep}
          railContext={railContext}
        />
      ) : (
        <ProjectStepRailCompact
          currentStep={currentStep}
          railContext={railContext}
        />
      )}
    </aside>
  )
}
