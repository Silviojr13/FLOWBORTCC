"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ProjectShell } from "@/components/project/project-shell"
import { ReportPanel } from "@/components/project/report-panel"
import { useProject } from "@/lib/use-project"

export default function ProjectReportPage() {
  const { id } = useParams<{ id: string }>()
  const { project, notFound, isLoading } = useProject(id)

  if (notFound) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-4 py-12 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">Projeto não encontrado.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/projects">Voltar para projetos</Link>
        </Button>
      </div>
    )
  }

  if (isLoading || !project) {
    return (
      <div className="mx-auto flex w-full max-w-4xl px-4 py-12 text-sm text-muted-foreground sm:px-6">
        Carregando...
      </div>
    )
  }

  return (
    <ProjectShell
      project={project}
      title="Relatórios"
      description="Relatório consolidado do projeto: progresso por sprint e por módulo, rastreabilidade dos requisitos e custos. Exporte em PDF, CSV ou Markdown."
    >
      <ReportPanel projectId={id} />
    </ProjectShell>
  )
}
