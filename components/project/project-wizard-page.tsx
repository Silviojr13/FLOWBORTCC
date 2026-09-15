"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarRangeIcon,
  FileTextIcon,
  LayoutGridIcon,
  KanbanIcon,
  PackageIcon,
  SparklesIcon,
} from "lucide-react"
import { RequirementsTable } from "@/components/project-manual/requirements-table"
import { AiChatAssistButton } from "@/components/project-manual/ai-assist-button"
import { ProjectIdentityCard } from "@/components/project-manual/project-identity-card"
import { FeaturesPanel } from "@/components/project-manual/features-panel"
import { ComponentsTable } from "@/components/project-manual/components-table"
import { ComponentSuggestions } from "@/components/project-manual/component-suggestions"
import { CostSummary } from "@/components/project-manual/cost-summary"
import { ProjectCreationSummary } from "@/components/project-manual/project-creation-summary"
import { ProjectCreationLayout } from "@/components/project-steps/project-creation-layout"
import { Button } from "@/components/ui/button"
import { MANUAL_STEP_CONTENT } from "@/lib/manual-step-content"
import {
  PROJECT_STEPS,
  getCurrentStepIndex,
  type ProjectStep,
} from "@/lib/project-steps"
import { useProject } from "@/lib/use-project"
import { isTaskOverdue, type KanbanColumn, type Task } from "@/lib/kanban"
import {
  isRequirementsSkipped,
  setRequirementsSkipped,
} from "@/lib/wizard-progress-store"

const STEP_KEYS = PROJECT_STEPS.map((s) => s.key)

function resolveStep(value: string | null): ProjectStep {
  return (STEP_KEYS as readonly string[]).includes(value ?? "")
    ? (value as ProjectStep)
    : "requisitos"
}

export function ProjectWizardPage({
  projectId,
  stepParam,
}: {
  projectId: string
  stepParam: string | null
}) {
  const router = useRouter()
  const { project, notFound, isLoading } = useProject(projectId)
  const [componentsRefreshKey, setComponentsRefreshKey] = useState(0)
  const [requirementsCount, setRequirementsCount] = useState(0)
  const [localRequirementsSkipped, setLocalRequirementsSkipped] = useState(false)
  const requirementsSkipped =
    localRequirementsSkipped || isRequirementsSkipped(projectId)

  const step = resolveStep(stepParam)
  const stepIndex = getCurrentStepIndex(step)
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === PROJECT_STEPS.length - 1
  const stepContent = MANUAL_STEP_CONTENT[step]

  useEffect(() => {
    if (step !== "requisitos" && step !== "finalizar") return

    let cancelled = false
    fetch(`/api/projects/${projectId}/requirements`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok || cancelled) return
        const count = data.requirements?.length ?? 0
        setRequirementsCount(count)
        if (count > 0 && isRequirementsSkipped(projectId)) {
          setRequirementsSkipped(projectId, false)
          setLocalRequirementsSkipped(false)
        }
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [projectId, step])

  function goToStep(nextStep: ProjectStep) {
    router.push(`/dashboard/projects/${projectId}?step=${nextStep}`)
  }

  function handleSkipRequirements() {
    setRequirementsSkipped(projectId, true)
    setLocalRequirementsSkipped(true)
    goToStep("funcionalidades")
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

  if (isLoading || !project) {
    return (
      <div className="mx-auto flex w-full max-w-4xl px-4 py-12 text-sm text-muted-foreground sm:px-6">
        Carregando...
      </div>
    )
  }

  const railContext = {
    requirementsCount,
    requirementsSkipped,
  }

  return (
    <ProjectCreationLayout currentStep={step} railContext={railContext}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit gap-1.5 px-2 text-muted-foreground"
          onClick={() => router.push("/dashboard/projects")}
        >
          <ArrowLeftIcon className="size-4" />
          Projetos
        </Button>

        <ProjectIdentityCard project={project} />

        {step !== "finalizar" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">{stepContent.title}</h2>
              <p className="text-sm text-muted-foreground">{stepContent.description}</p>
            </div>
            {step === "requisitos" && <AiChatAssistButton />}
          </div>
        )}

        {step === "requisitos" && (
          <div className="flex flex-col gap-4">
            <RequirementsTable
              projectId={project.id}
              onCountChange={(count) => {
                setRequirementsCount(count)
                if (count > 0) {
                  setRequirementsSkipped(projectId, false)
                  setLocalRequirementsSkipped(false)
                }
              }}
            />
            {project.origin === "manual" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleSkipRequirements}>
                  Pular requisitos
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "funcionalidades" && (
          <FeaturesPanel projectId={project.id} variant="wizard" />
        )}

        {step === "componentes" && (
          <div className="flex flex-col gap-8">
            <ComponentSuggestions
              projectId={project.id}
              autoGenerate
              onAdded={() => setComponentsRefreshKey((k) => k + 1)}
            />
            <ComponentsTable key={componentsRefreshKey} projectId={project.id} />
          </div>
        )}

        {step === "custos" && <CostSummary projectId={project.id} />}

        {step === "finalizar" && (
          <ProjectCreationSummary projectId={project.id} requirementsSkipped={requirementsSkipped} />
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
              Continuar
              <ArrowRightIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </ProjectCreationLayout>
  )
}

export function ProjectOverviewContent({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState<{
    requirementsCount: number
    requirementsUncovered: string[]
    featuresTotal: number
    featuresByStatus: Record<string, number>
    tasksTotal: number
    tasksDone: number
    tasksOverdue: number
    tasksByColumn: { name: string; count: number }[]
    componentsCount: number
    totalCost: number
    requirementsSkipped: boolean
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const [reqRes, featRes, compRes, kanbanRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/requirements`),
          fetch(`/api/projects/${projectId}/features`),
          fetch(`/api/projects/${projectId}/components`),
          fetch(`/api/projects/${projectId}/kanban`),
        ])
        const [reqData, featData, compData, kanbanData] = await Promise.all([
          reqRes.json(),
          featRes.json(),
          compRes.json(),
          kanbanRes.json(),
        ])

        if (cancelled) return

        // Indicadores de saúde do projeto (RF14): tarefas concluídas/atrasadas e requisitos sem cobertura.
        const columns: KanbanColumn[] = kanbanRes.ok ? kanbanData.columns : []
        const tasks: Task[] = kanbanRes.ok ? kanbanData.tasks : []
        const doneColumnIds = new Set(columns.filter((c) => c.isDone).map((c) => c.id))
        const tasksDone = tasks.filter((t) => doneColumnIds.has(t.columnId)).length
        const tasksOverdue = tasks.filter((t) => isTaskOverdue(t, doneColumnIds.has(t.columnId))).length
        const tasksByColumn = columns.map((c) => ({
          name: c.name,
          count: tasks.filter((t) => t.columnId === c.id).length,
        }))
        const coveredRequirementIds = new Set(
          tasks.map((t) => t.requirementId).filter((id): id is string => !!id)
        )
        const requirementsList: { id: string; code: string }[] = reqRes.ok ? reqData.requirements : []
        const requirementsUncovered = requirementsList
          .filter((r) => !coveredRequirementIds.has(r.id))
          .map((r) => r.code)

        const features = featRes.ok ? featData.features : []
        const byStatus: Record<string, number> = {
          Planejada: 0,
          "Em desenvolvimento": 0,
          Concluída: 0,
        }
        for (const f of features) {
          if (f.status in byStatus) byStatus[f.status]++
        }

        const components = compRes.ok ? compData.components : []
        const totalCost = components.reduce(
          (sum: number, c: { quantity: number; unitPrice: number }) =>
            sum + c.quantity * c.unitPrice,
          0
        )

        setStats({
          requirementsCount: requirementsList.length,
          requirementsUncovered,
          featuresTotal: features.length,
          featuresByStatus: byStatus,
          tasksTotal: tasks.length,
          tasksDone,
          tasksOverdue,
          tasksByColumn,
          componentsCount: components.length,
          totalCost,
          requirementsSkipped: isRequirementsSkipped(projectId),
        })
      } catch (error) {
        console.error(error)
        toast.error("Erro ao carregar visão geral.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
  const completed = stats?.tasksDone ?? 0
  const total = stats?.tasksTotal ?? 0
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  const shortcuts = [
    {
      href: `/dashboard/projects/${projectId}/features`,
      label: "Funcionalidades",
      icon: SparklesIcon,
      description: "Gerenciar capacidades do projeto",
    },
    {
      href: `/dashboard/projects/${projectId}/kanban`,
      label: "Kanban",
      icon: KanbanIcon,
      description: "Tarefas por estado, com drag-and-drop",
    },
    {
      href: `/dashboard/projects/${projectId}/sprints`,
      label: "Sprints",
      icon: CalendarRangeIcon,
      description: "Planejar ciclos e acompanhar progresso",
    },
    {
      href: `/dashboard/projects/${projectId}/components-costs`,
      label: "Componentes e Custos",
      icon: PackageIcon,
      description: "Lista de peças e orçamento",
    },
    {
      href: `/dashboard/projects/${projectId}/report`,
      label: "Relatórios",
      icon: FileTextIcon,
      description: "Consolidado com export PDF/CSV/MD",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando visão geral...</p>
      )}

      {!isLoading && stats && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card/95 px-4 py-3">
              <p className="text-xs text-muted-foreground">Tarefas</p>
              <p className="mt-1 text-2xl font-semibold">{stats.tasksTotal}</p>
              <p className="text-xs text-muted-foreground">
                {stats.featuresTotal} funcionalidade(s)
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/95 px-4 py-3">
              <p className="text-xs text-muted-foreground">Progresso</p>
              <p className="mt-1 text-2xl font-semibold">{progressPct}%</p>
              <p className="text-xs text-muted-foreground">
                {completed} de {total} tarefa(s) concluída(s)
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/95 px-4 py-3">
              <p className="text-xs text-muted-foreground">Tarefas em atraso</p>
              <p className={`mt-1 text-2xl font-semibold ${stats.tasksOverdue > 0 ? "text-destructive" : ""}`}>
                {stats.tasksOverdue}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/95 px-4 py-3">
              <p className="text-xs text-muted-foreground">Requisitos sem cobertura</p>
              <p className={`mt-1 text-2xl font-semibold ${stats.requirementsUncovered.length > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                {stats.requirementsUncovered.length}
              </p>
              {stats.requirementsUncovered.length > 0 && (
                <p className="truncate font-mono text-xs text-muted-foreground" title={stats.requirementsUncovered.join(", ")}>
                  {stats.requirementsUncovered.join(", ")}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card/95 px-4 py-3">
              <p className="text-xs text-muted-foreground">Componentes</p>
              <p className="mt-1 text-2xl font-semibold">{stats.componentsCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/95 px-4 py-3">
              <p className="text-xs text-muted-foreground">Custo estimado</p>
              <p className="mt-1 text-2xl font-semibold">{currency.format(stats.totalCost)}</p>
            </div>
          </div>

          {stats.tasksByColumn.length > 0 && (
            <div className="rounded-xl border border-border bg-card/95 px-4 py-4">
              <p className="text-sm font-medium">Tarefas por coluna do Kanban</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {stats.tasksByColumn.map((c) => (
                  <span key={c.name}>
                    <span className="text-muted-foreground">{c.name}:</span> {c.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card/95 px-4 py-4">
            <p className="text-sm font-medium">Status das funcionalidades</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span>
                <span className="text-muted-foreground">Planejada:</span>{" "}
                {stats.featuresByStatus["Planejada"]}
              </span>
              <span>
                <span className="text-muted-foreground">Em desenvolvimento:</span>{" "}
                {stats.featuresByStatus["Em desenvolvimento"]}
              </span>
              <span>
                <span className="text-muted-foreground">Concluída:</span>{" "}
                {stats.featuresByStatus["Concluída"]}
              </span>
            </div>
          </div>

          {stats.requirementsCount === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                {stats.requirementsSkipped
                  ? "Requisitos não foram definidos na criação."
                  : "Nenhum requisito registrado ainda."}{" "}
                <Link
                  href={`/dashboard/projects/${projectId}?step=requisitos`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Definir requisitos
                </Link>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Atalhos</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {shortcuts.map(({ href, label, icon: Icon, description }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href={`/dashboard/projects/${projectId}?step=requisitos`}>
                <LayoutGridIcon className="size-4" />
                Retomar wizard
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
