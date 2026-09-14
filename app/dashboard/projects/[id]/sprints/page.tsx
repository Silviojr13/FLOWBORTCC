"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ProjectShell } from "@/components/project/project-shell"
import { SprintsPanel } from "@/components/project/sprints-panel"
import { useProject } from "@/lib/use-project"

export default function ProjectSprintsPage() {
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
      title="Sprints"
      description="Planeje ciclos de desenvolvimento com período e objetivo, associe tarefas do Kanban e acompanhe o progresso."
    >
      <SprintsPanel projectId={id} />
    </ProjectShell>
  )
}
