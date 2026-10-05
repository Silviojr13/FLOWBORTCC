"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { FlowbotMark } from "@/components/flowbot-brand-logo"
import { ProjectCard, type ProjectCardData } from "@/components/project/project-card"
import { PendingInvitations } from "@/components/sharing/pending-invitations"
import { Button } from "@/components/ui/button"
import { Workspace } from "@/components/layout/workspace"
import { useProjectLocalMeta } from "@/lib/use-project-local-meta"

function ProjectCardWithImage({
  project,
  onDeleted,
}: {
  project: ProjectCardData
  onDeleted: (projectId: string) => void
}) {
  const meta = useProjectLocalMeta(project.id)
  const displayProject = {
    ...project,
    name: meta.name?.trim() || project.name,
    description: meta.description ?? project.description,
  }
  return <ProjectCard project={displayProject} imageUrl={meta.imageDataUrl} onDeleted={onDeleted} />
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectCardData[]>([])
  const [shared, setShared] = useState<ProjectCardData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setProjects(data.projects)
        setShared(data.shared ?? [])
      })
      .catch((error) => {
        console.error(error)
        toast.error("Não foi possível carregar os projetos.")
      })
      .finally(() => setIsLoading(false))
  }, [])

  const hasProjects = projects.length > 0

  return (
    <Workspace width="wide" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy dark:text-foreground sm:text-3xl">
            Projetos
          </h1>
        </div>
        <Button asChild className="h-10 w-full gap-1.5 sm:w-auto" data-tour="projects-new">
          <Link href="/dashboard/projects/new">
            <PlusIcon className="size-4" />
            Novo projeto
          </Link>
        </Button>
      </div>

      <PendingInvitations />

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando projetos...</p>
      )}

      {!isLoading && !hasProjects && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/70 px-6 py-14 text-center">
          <FlowbotMark className="size-14" />
          <div className="flex max-w-md flex-col gap-1">
            <p className="text-base font-medium text-foreground">
              Seu primeiro projeto começa aqui.
            </p>
            <p className="text-sm text-muted-foreground">
              Crie um projeto com a ajuda da IA ou estruture manualmente.
            </p>
          </div>
          <Button asChild className="gap-1.5">
            <Link href="/dashboard/projects/new">
              <PlusIcon className="size-4" />
              Criar novo projeto
            </Link>
          </Button>
        </div>
      )}

      {!isLoading && hasProjects && (
        <div data-tour="projects-list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCardWithImage
              key={project.id}
              project={project}
              onDeleted={(id) => setProjects((list) => list.filter((p) => p.id !== id))}
            />
          ))}
        </div>
      )}

      {!isLoading && shared.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground">Compartilhados comigo</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shared.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
    </Workspace>
  )
}
