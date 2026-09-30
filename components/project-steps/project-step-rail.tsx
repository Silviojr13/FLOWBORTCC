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
        className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-hidden
      />
    )
  }

  if (status === "current") {
    return <CircleDotIcon className="size-4 shrink-0 text-primary" aria-hidden />
  }

  if (status === "skipped") {
    return (
      <MinusCircleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    )
  }

  return (
    <CircleIcon className="size-4 shrink-0 text-muted-foreground/45" aria-hidden />
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
    <li className="relative flex gap-2.5">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            "absolute top-7 bottom-0 left-2 w-px -translate-x-1/2",
            status === "completed"
              ? "bg-emerald-200/80 dark:bg-emerald-800/60"
              : "bg-border/80"
          )}
        />
      )}

      <div className="relative z-10 flex w-4 shrink-0 justify-center pt-1">
        <StepStatusIcon status={status} />
      </div>

      <div
        aria-current={status === "current" ? "step" : undefined}
        className={cn(
          "mb-3 min-w-0 flex-1 rounded-md border px-3 py-2",
          status === "current" && "border-primary/40 bg-primary/10",
          status === "completed" &&
            "border-emerald-300/80 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/40",
          status === "skipped" && "border-border bg-muted/40",
          status === "upcoming" && "border-transparent bg-transparent px-3 py-2"
        )}
      >
        <div className="flex items-center gap-2">
          <step.icon
            className={cn(
              "size-3.5 shrink-0",
              status === "current" && "text-primary",
              status === "completed" && "text-emerald-600 dark:text-emerald-400",
              status === "skipped" && "text-muted-foreground",
              status === "upcoming" && "text-muted-foreground"
            )}
            aria-hidden
          />
          <p
            className={cn(
              "text-sm font-medium leading-tight",
              status === "current" && "text-primary",
              status === "completed" && "text-emerald-700 dark:text-emerald-300",
              status === "skipped" && "text-muted-foreground",
              status === "upcoming" && "text-muted-foreground"
            )}
          >
            {step.label}
          </p>
        </div>
        {hint && (
          <p
            className={cn(
              "mt-1 pl-6 text-xs leading-tight",
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
      className="rounded-lg border border-border bg-card px-3.5 py-3 shadow-sm dark:shadow-none"
    >
      <p className="text-xs text-muted-foreground">
        Etapa {currentIndex + 1} de {PROJECT_STEPS.length}
      </p>
      <p className="mt-0.5 text-sm font-medium text-primary">{current.label}</p>

      <div className="mt-2.5 flex gap-1.5" aria-hidden>
        {PROJECT_STEPS.map((step, index) => {
          const status = getStepStatus(index, currentIndex, railContext)

          return (
            <div
              key={step.key}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
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
