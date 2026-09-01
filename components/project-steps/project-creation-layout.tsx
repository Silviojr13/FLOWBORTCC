import { ProjectStepRail } from "@/components/project-steps/project-step-rail"
import type { ProjectStep, StepRailContext } from "@/lib/project-steps"

export function ProjectCreationLayout({
  currentStep,
  railContext,
  children,
}: {
  currentStep: ProjectStep
  railContext?: StepRailContext
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 sm:gap-6 sm:px-6">
      <ProjectStepRail
        currentStep={currentStep}
        variant="compact"
        railContext={railContext}
        className="xl:hidden"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 xl:flex-row xl:items-start xl:gap-10 2xl:gap-12">
        <div className="min-w-0 flex-1">{children}</div>

        <ProjectStepRail
          currentStep={currentStep}
          variant="rail"
          railContext={railContext}
          className="hidden w-44 shrink-0 xl:sticky xl:top-[calc(var(--header-height)+1.5rem)] xl:block xl:w-48"
        />
      </div>
    </div>
  )
}
