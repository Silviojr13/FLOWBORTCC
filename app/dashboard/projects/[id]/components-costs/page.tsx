"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
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
      title="Componentes e Custos"
      description="Lista de componentes do projeto e resumo do investimento estimado."
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
