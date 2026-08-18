import { ProjectCreationLayout } from "@/components/project-steps/project-creation-layout"
import { RequirementsTable } from "@/components/project-manual/requirements-table"

export default function ManualProjectPage() {
  return (
    <ProjectCreationLayout currentStep="requisitos">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">
            Criar projeto manualmente
          </h1>
          <p className="text-sm text-muted-foreground">
            Estruture os requisitos funcionais do seu projeto.
          </p>
        </div>

        <RequirementsTable />
      </div>
    </ProjectCreationLayout>
  )
}
