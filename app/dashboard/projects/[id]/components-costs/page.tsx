"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { workspaceGutter } from "@/components/layout/workspace"
import { ProjectShell } from "@/components/project/project-shell"
import { ComponentsTable } from "@/components/project-manual/components-table"
import { CostSummary } from "@/components/project-manual/cost-summary"
import { useProject } from "@/lib/use-project"

export default function ProjectComponentsCostsPage() {
  const { id } = useParams<{ id: string }>()
  const { project, notFound, isLoading } = useProject(id)
  const [refreshToken, setRefreshToken] = useState(0)

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
      title="Componentes e Custos"
      width="focused"
    >
      <div className="flex flex-col gap-8">
        <ComponentsTable
          projectId={id}
          onChange={() => setRefreshToken((t) => t + 1)}
        />
        <CostSummary projectId={id} refreshToken={refreshToken} />
      </div>
    </ProjectShell>
  )
}
