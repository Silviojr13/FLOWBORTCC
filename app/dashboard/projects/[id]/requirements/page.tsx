"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { workspaceGutter } from "@/components/layout/workspace"
import { ProjectShell } from "@/components/project/project-shell"
import { RequirementsTable } from "@/components/project-manual/requirements-table"
import { useProject } from "@/lib/use-project"

/**
 * Requisitos de um projeto em andamento. A trilha de etapas com Voltar/Continuar fica só no
 * assistente de criação (?step=); aqui a tela segue o padrão das outras abas do projeto.
 */
export default function ProjectRequirementsPage() {
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
      title="Requisitos"
      description="O que o projeto precisa atender, com a cobertura no Kanban, o custo e o histórico de cada requisito."
    >
      <RequirementsTable projectId={id} />
    </ProjectShell>
  )
}
