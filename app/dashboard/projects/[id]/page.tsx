"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { RequirementsTable } from "@/components/project-manual/requirements-table"
import { ComponentsTable } from "@/components/project-manual/components-table"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeftIcon } from "lucide-react"

interface ProjectDetail {
  id: string
  name: string
  description: string | null
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Projeto não encontrado")
        setProject(data.project)
      })
      .catch((error) => {
        console.error(error)
        setNotFound(true)
        toast.error(error instanceof Error ? error.message : "Erro ao carregar projeto.")
      })
  }, [id])

  if (notFound) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-4 py-12 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">Projeto não encontrado.</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/projects")}>
          Voltar para projetos
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 sm:px-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit gap-1.5 px-2 text-muted-foreground"
          onClick={() => router.push("/dashboard/projects")}
        >
          <ArrowLeftIcon className="size-4" />
          Projetos
        </Button>
        <h1 className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">
          {project?.name ?? "Carregando..."}
        </h1>
        {project?.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </div>

      {project && (
        <Tabs defaultValue="requisitos">
          <TabsList>
            <TabsTrigger value="requisitos">Requisitos</TabsTrigger>
            <TabsTrigger value="componentes">Componentes &amp; Custos</TabsTrigger>
          </TabsList>
          <TabsContent value="requisitos">
            <RequirementsTable projectId={project.id} />
          </TabsContent>
          <TabsContent value="componentes">
            <ComponentsTable projectId={project.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
