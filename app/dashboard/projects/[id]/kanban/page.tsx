"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ProjectShell } from "@/components/project/project-shell"
import { KanbanBoard } from "@/components/project/kanban-board"
import { useProject } from "@/lib/use-project"

export default function ProjectKanbanPage() {
  const { id } = useParams<{ id: string }>()
  const { project, notFound, isLoading } = useProject(id)

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
      title="Kanban"
      description="Organize as tarefas do projeto por estado. Arraste os cards entre colunas ou mova pelo select; cada tarefa pode ser vinculada a um requisito e a uma sprint."
    >
      <KanbanBoard projectId={id} />
    </ProjectShell>
  )
}
