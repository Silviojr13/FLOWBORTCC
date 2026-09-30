"use client"

import Link from "next/link"
import { toast } from "sonner"
import { ArrowRightIcon, Link2Icon, MoreHorizontalIcon } from "lucide-react"
import { ProjectCover } from "@/components/project/project-cover"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface ProjectCardData {
  id: string
  name: string
  description: string | null
  updatedAt: string
  _count: { requirements: number; tasks: number; components: number }
}

function plural(count: number, singular: string, pluralLabel: string) {
  return `${count} ${count === 1 ? singular : pluralLabel}`
}

function metricsLine(project: ProjectCardData) {
  const parts: string[] = []
  if (project._count.requirements > 0) {
    parts.push(plural(project._count.requirements, "requisito", "requisitos"))
  }
  if (project._count.tasks > 0) {
    parts.push(plural(project._count.tasks, "tarefa", "tarefas"))
  }
  if (project._count.components > 0) {
    parts.push(plural(project._count.components, "componente", "componentes"))
  }
  return parts.length > 0 ? parts.join(" · ") : null
}

function formatUpdated(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
  }).format(date)
}

async function copyProjectLink(projectId: string) {
  const url = new URL(
    `/dashboard/projects/${projectId}`,
    window.location.origin
  ).toString()

  try {
    await navigator.clipboard.writeText(url)
    toast.success("Link copiado")
  } catch (error) {
    console.error(error)
    toast.error("Não foi possível copiar o link.")
  }
}

export function ProjectCard({
  project,
  imageUrl,
}: {
  project: ProjectCardData
  imageUrl?: string
}) {
  const href = `/dashboard/projects/${project.id}`
  const metrics = metricsLine(project)
  const updated = formatUpdated(project.updatedAt)

  return (
    <Card className="relative h-full gap-0 overflow-hidden py-0 transition-shadow hover:border-primary/40 hover:shadow-md">
      <Link
        href={href}
        aria-label={`Abrir projeto ${project.name}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />

      <div className="pointer-events-none relative z-[1] flex h-full flex-col">
        <div className="aspect-[16/10] w-full overflow-hidden border-b border-border bg-muted">
          <ProjectCover imageUrl={imageUrl} />
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 truncate text-base font-semibold text-foreground" title={project.name}>
              {project.name}
            </h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto relative z-10 -mt-1 -mr-1 size-9 shrink-0 text-muted-foreground"
                  aria-label={`Ações do projeto ${project.name}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuItem
                  className="gap-2 py-2"
                  onSelect={() => {
                    void copyProjectLink(project.id)
                  }}
                >
                  <Link2Icon />
                  Copiar link do projeto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
            {project.description}
          </p>

          <div className="mt-auto flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              {metrics ?? (updated ? `Atualizado em ${updated}` : "Projeto")}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
              Abrir
              <ArrowRightIcon className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
