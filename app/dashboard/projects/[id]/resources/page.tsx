"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { workspaceGutter } from "@/components/layout/workspace"
import { ProjectShell } from "@/components/project/project-shell"
import { ResourcesPanel } from "@/components/resources/resources-panel"
import { useProject } from "@/lib/use-project"

export default function ProjectResourcesPage() {
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
      title="Recursos"
      description="Pessoas, equipamentos, software e espaços que o projeto usa, com o orçamento consolidado."
      width="wide"
    >
      {project.access.canSeeCosts ? (
        <ResourcesPanel projectId={id} />
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Os recursos ficam ocultos para o seu cargo, porque trazem custos e o valor da hora das
          pessoas. Se precisar vê-los, peça a quem compartilhou o projeto.
        </p>
      )}
    </ProjectShell>
  )
}
