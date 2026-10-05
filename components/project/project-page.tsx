"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { workspaceGutter, type WorkspaceWidth } from "@/components/layout/workspace"
import { ProjectShell } from "@/components/project/project-shell"
import { useProject, type ProjectDetail } from "@/lib/use-project"

/**
 * Página de uma aba do projeto: carrega o projeto da URL, trata "não encontrado" e o
 * carregamento, e monta o ProjectShell com o título. O conteúdo recebe o projeto pronto.
 */
export function ProjectPage({
  title,
  description,
  width = "wide",
  children,
}: Readonly<{
  title: string
  description?: string
  width?: WorkspaceWidth
  children: (project: ProjectDetail) => React.ReactNode
}>) {
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
    return <div className={`flex w-full py-12 text-sm text-muted-foreground ${workspaceGutter}`}>Carregando...</div>
  }

  return (
    <ProjectShell project={project} title={title} description={description} width={width}>
      {children(project)}
    </ProjectShell>
  )
}
