"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { PlusIcon, FolderIcon } from "lucide-react"

interface ProjectSummary {
  id: string
  name: string
  description: string | null
  updatedAt: string
  _count: { requirements: number; tasks: number; components: number }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setProjects(data.projects)
      })
      .catch((error) => {
        console.error(error)
        toast.error("Não foi possível carregar os projetos.")
      })
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy dark:text-foreground sm:text-3xl">
            Projetos
          </h1>
          <p className="text-sm text-muted-foreground">
            Seus projetos de robótica e sistemas embarcados.
          </p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/dashboard/projects/new/manual">
            <PlusIcon className="size-4" />
            Novo projeto
          </Link>
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando projetos...</p>
      )}

      {!isLoading && projects.length === 0 && (
        <Card className="items-center py-12 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <FolderIcon className="size-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              Você ainda não tem nenhum projeto.
            </p>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/dashboard/projects/new/manual">
                <PlusIcon className="size-4" />
                Criar o primeiro projeto
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
            <Card className="h-full border-border shadow-sm transition-colors hover:border-primary/30 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{project.name}</CardTitle>
                {project.description && (
                  <CardDescription className="line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {project._count.requirements} requisito(s) · {project._count.tasks} tarefa(s) ·{" "}
                {project._count.components} componente(s)
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
