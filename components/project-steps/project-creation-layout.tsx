import { Workspace } from "@/components/layout/workspace"
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
    <Workspace width="creation" className="mx-auto flex w-full flex-1 flex-col gap-8 pt-4 lg:pt-8">
      <ProjectStepRail
        currentStep={currentStep}
        variant="compact"
        railContext={railContext}
        className="xl:hidden"
      />

      <div className="flex min-h-0 w-full flex-1 flex-col gap-8 xl:flex-row xl:items-start xl:gap-10">
        <div className="min-w-0 flex-1">{children}</div>

        <ProjectStepRail
          currentStep={currentStep}
          variant="rail"
          railContext={railContext}
          className="hidden w-60 shrink-0 xl:sticky xl:top-[calc(var(--header-height)+2rem)] xl:block"
        />
      </div>
    </Workspace>
  )
}
