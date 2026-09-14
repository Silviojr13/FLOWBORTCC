"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
  TargetIcon,
  Trash2Icon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PriorityIndicator } from "@/components/project-manual/requirement-indicators"
import { SprintDialog } from "@/components/project/sprint-dialog"
import {
  formatDate,
  isTaskOverdue,
  type KanbanColumn,
  type Sprint,
  type SprintStatus,
  type Task,
} from "@/lib/kanban"
import { cn } from "@/lib/utils"

const STATUS_BADGE: Record<SprintStatus, string> = {
  Planejada: "border-primary/25 bg-primary/5 text-primary",
  "Em andamento":
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  Concluída:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
}

function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
        {done}/{total} · {pct}%
      </span>
    </div>
  )
}

// Planejamento e acompanhamento de sprints (RF08, UC07, UC13).
export function SprintsPanel({ projectId }: { projectId: string }) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dialogSprint, setDialogSprint] = useState<Sprint | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const load = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false

    async function fetchSprints() {
      try {
        const res = await fetch(`/api/projects/${projectId}/kanban`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao carregar sprints")
        if (cancelled) return
        setSprints(data.sprints)
        setTasks(data.tasks)
        setColumns(data.columns)
      } catch (error) {
        console.error(error)
        toast.error(error instanceof Error ? error.message : "Não foi possível carregar as sprints.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void fetchSprints()
    return () => {
      cancelled = true
    }
  }, [projectId, refreshKey])

  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  const backlogCount = tasks.filter((t) => t.sprintId === null).length

  function openCreate() {
    setDialogSprint(null)
    setIsDialogOpen(true)
  }

  function openEdit(sprint: Sprint) {
    setDialogSprint(sprint)
    setIsDialogOpen(true)
  }

  async function deleteSprint(sprint: Sprint) {
    if (!window.confirm(`Excluir a sprint "${sprint.name}"? As tarefas voltam para o backlog.`)) return
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprint.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao excluir sprint")
      }
      toast.success("Sprint excluída.")
      load()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir sprint.")
    }
  }

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando sprints...</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <PlusIcon className="size-4" />
          Planejar sprint
        </Button>
        <span className="text-xs text-muted-foreground">
          {backlogCount} tarefa(s) sem sprint
        </span>
      </div>

      {sprints.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">Nenhuma sprint planejada.</p>
          <p className="text-sm text-muted-foreground">
            Defina um período, um objetivo e escolha as tarefas do Kanban que compõem o ciclo.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sprints.map((sprint) => {
          const isExpanded = expandedId === sprint.id
          const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id)

          // Progresso por responsável (UC13 fluxo alternativo).
          const byAssignee = new Map<string, { total: number; done: number }>()
          for (const t of sprintTasks) {
            const key = t.assignee ?? "Sem responsável"
            const entry = byAssignee.get(key) ?? { total: 0, done: 0 }
            entry.total++
            if (columnById.get(t.columnId)?.isDone) entry.done++
            byAssignee.set(key, entry)
          }

          return (
            <Card key={sprint.id} className="bg-card/95">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base leading-snug">
                    {sprint.name}
                    <Badge variant="outline" className={cn("font-normal", STATUS_BADGE[sprint.status])}>
                      {sprint.status}
                    </Badge>
                  </CardTitle>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarIcon className="size-3.5" aria-hidden />
                    {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                  </p>
                  {sprint.goal && (
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <TargetIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {sprint.goal}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Editar sprint" onClick={() => openEdit(sprint)}>
                    <PencilIcon className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Excluir sprint"
                    onClick={() => deleteSprint(sprint)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-3 pt-0">
                <ProgressBar done={sprint.tasksDone} total={sprint.tasksTotal} />

                {isExpanded && (
                  <div className="flex flex-col gap-4 border-t border-border pt-3">
                    {byAssignee.size > 0 && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Progresso por responsável
                        </p>
                        {Array.from(byAssignee.entries()).map(([name, { total, done }]) => (
                          <div key={name} className="flex items-center gap-3 text-sm">
                            <span className="w-32 shrink-0 truncate">{name}</span>
                            <ProgressBar done={done} total={total} className="flex-1" />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Tarefas ({sprintTasks.length})
                      </p>
                      {sprintTasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma tarefa nesta sprint.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {sprintTasks.map((task) => {
                            const column = columnById.get(task.columnId)
                            const done = column?.isDone ?? false
                            const overdue = isTaskOverdue(task, done)
                            return (
                              <li
                                key={task.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2 text-sm"
                              >
                                <span className={cn("min-w-0 flex-1 truncate font-medium", done && "text-muted-foreground line-through")}>
                                  {task.title}
                                </span>
                                <PriorityIndicator value={task.priority} />
                                {column && (
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    {column.name}
                                  </Badge>
                                )}
                                {task.assignee && (
                                  <span className="text-xs text-muted-foreground">{task.assignee}</span>
                                )}
                                {task.dueDate && (
                                  <span className={cn("text-xs text-muted-foreground", overdue && "font-medium text-destructive")}>
                                    {formatDate(task.dueDate)}
                                  </span>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-muted-foreground"
                  onClick={() => setExpandedId(isExpanded ? null : sprint.id)}
                >
                  {isExpanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                  {isExpanded ? "Ocultar detalhes" : "Ver progresso e tarefas"}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <SprintDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        projectId={projectId}
        sprint={dialogSprint}
        tasks={tasks}
        columns={columns}
        onSaved={() => load()}
      />
    </div>
  )
}
