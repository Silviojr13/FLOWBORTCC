"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { workspaceGutter } from "@/components/layout/workspace"
import { ProjectShell } from "@/components/project/project-shell"
import { DevNotesPanel } from "@/components/project/dev-notes-panel"
import { useProject } from "@/lib/use-project"

export default function ProjectDevelopmentPage() {
  const { id } = useParams<{ id: string }>()
  const { project, notFound, isLoading } = useProject(id)

  if (notFound) {
    return (
      <div className={`flex w-full flex-col items-center gap-4 py-12 text-center ${workspaceGutter}`}>
        <p className="text-sm text-muted-foreground">Projeto não encontrado.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/projects">Voltar para projetos</Link>
        </Button>
      </div>
    )
  }

  if (isLoading || !project) {
    return (
      <div className={`flex w-full py-12 text-sm text-muted-foreground ${workspaceGutter}`}>
        Carregando...
      </div>
    )
  }

  return (
    <ProjectShell
      project={project}
      title="Desenvolvimento"
      description="O que o Claude Code desenvolveu, os problemas e as dúvidas, registrados pela ponte com o FlowBot."
      width="focused"
    >
      <DevNotesPanel projectId={id} />
    </ProjectShell>
  )
}
