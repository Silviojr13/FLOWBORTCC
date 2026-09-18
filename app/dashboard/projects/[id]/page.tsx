"use client"

import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ProjectShell } from "@/components/project/project-shell"
import {
  ProjectOverviewContent,
  ProjectWizardPage,
} from "@/components/project/project-wizard-page"
import { useProject } from "@/lib/use-project"

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const stepParam = searchParams.get("step")
  const { project, notFound, isLoading } = useProject(id)

  if (stepParam) {
    return <ProjectWizardPage projectId={id} stepParam={stepParam} />
  }

  if (notFound) {
    return (
      <div className="flex w-full flex-col items-center gap-4 px-4 py-12 text-center sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">Projeto não encontrado.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/projects">Voltar para projetos</Link>
        </Button>
      </div>
    )
  }

  if (isLoading || !project) {
    return (
      <div className="flex w-full px-4 py-12 text-sm text-muted-foreground sm:px-6 lg:px-8">
        Carregando...
      </div>
    )
  }

  return (
    <ProjectShell
      project={project}
      title="Visão geral"
      description="Resumo do projeto e atalhos para os módulos de gestão."
    >
      <ProjectOverviewContent projectId={id} />
    </ProjectShell>
  )
}
