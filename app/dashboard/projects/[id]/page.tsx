"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { RequirementsTable } from "@/components/project-manual/requirements-table"
import { FeaturesTable } from "@/components/project-manual/features-table"
import { ComponentsTable } from "@/components/project-manual/components-table"
import { ComponentSuggestions } from "@/components/project-manual/component-suggestions"
import { CostSummary } from "@/components/project-manual/cost-summary"
import { ProjectCreationLayout } from "@/components/project-steps/project-creation-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  PROJECT_STEPS,
  getCurrentStepIndex,
  type ProjectStep,
} from "@/lib/project-steps"
import { ArrowLeftIcon, ArrowRightIcon, CircleCheckIcon } from "lucide-react"

interface ProjectDetail {
  id: string
  name: string
  description: string | null
  origin: "manual" | "ia"
}

const STEP_KEYS = PROJECT_STEPS.map((s) => s.key)

function resolveStep(value: string | null): ProjectStep {
  return (STEP_KEYS as readonly string[]).includes(value ?? "")
    ? (value as ProjectStep)
    : "requisitos"
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [componentsRefreshKey, setComponentsRefreshKey] = useState(0)

  const step = resolveStep(searchParams.get("step"))
  const stepIndex = getCurrentStepIndex(step)
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === PROJECT_STEPS.length - 1

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

  function goToStep(nextStep: ProjectStep) {
    router.push(`/dashboard/projects/${id}?step=${nextStep}`)
  }

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

  if (!project) {
    return (
      <div className="mx-auto flex w-full max-w-4xl px-4 py-12 text-sm text-muted-foreground sm:px-6">
        Carregando...
      </div>
    )
  }

  return (
    <ProjectCreationLayout currentStep={step}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
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
            {project.name}
          </h1>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>

        {step === "requisitos" && <RequirementsTable projectId={project.id} />}
        {step === "funcionalidades" && <FeaturesTable projectId={project.id} />}
        {step === "componentes" && (
          <div className="flex flex-col gap-6">
            <ComponentSuggestions
              projectId={project.id}
              autoGenerate={project.origin === "ia"}
              onAdded={() => setComponentsRefreshKey((k) => k + 1)}
            />
            <ComponentsTable key={componentsRefreshKey} projectId={project.id} />
          </div>
        )}
        {step === "custos" && <CostSummary projectId={project.id} />}
        {step === "finalizar" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CircleCheckIcon className="size-8 text-emerald-400" />
              <p className="text-sm text-muted-foreground">
                Requisitos, funcionalidades, componentes e custos definidos. O quadro Kanban
                para acompanhar a execução chega em uma próxima etapa do projeto.
              </p>
              <Button onClick={() => router.push("/dashboard/projects")}>
                Concluir e voltar para Projetos
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={isFirstStep}
            onClick={() => goToStep(PROJECT_STEPS[stepIndex - 1].key)}
          >
            <ArrowLeftIcon className="size-4" />
            Voltar
          </Button>
          {!isLastStep && (
            <Button
              className="gap-1.5"
              onClick={() => goToStep(PROJECT_STEPS[stepIndex + 1].key)}
            >
              Próximo: {PROJECT_STEPS[stepIndex + 1].label}
              <ArrowRightIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </ProjectCreationLayout>
  )
}
