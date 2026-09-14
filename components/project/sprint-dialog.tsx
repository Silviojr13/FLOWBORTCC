"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowDownWideNarrowIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { PriorityIndicator } from "@/components/project-manual/requirement-indicators"
import {
  sortTasksByPriority,
  toDateInputValue,
  type KanbanColumn,
  type Sprint,
  type Task,
} from "@/lib/kanban"
import { cn } from "@/lib/utils"

interface SprintDraft {
  name: string
  goal: string
  startDate: string
  endDate: string
  taskIds: string[]
}

// Planejamento de sprint (RF08 / UC07): período, objetivo e seleção de tarefas.
// Exige ao menos uma tarefa (fluxo de exceção do UC07) e permite ordenar por prioridade
// (fluxo alternativo).
interface SprintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  sprint: Sprint | null
  tasks: Task[]
  columns: KanbanColumn[]
  onSaved: () => void
}

export function SprintDialog(props: SprintDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <SprintDialogForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

// Formulário em componente interno: o DialogContent desmonta ao fechar, então o rascunho
// reinicia a cada abertura sem precisar de efeito.
function SprintDialogForm({
  onOpenChange,
  projectId,
  sprint,
  tasks,
  columns,
  onSaved,
}: SprintDialogProps) {
  const [draft, setDraft] = useState<SprintDraft>(() => ({
    name: sprint?.name ?? "",
    goal: sprint?.goal ?? "",
    startDate: toDateInputValue(sprint?.startDate),
    endDate: toDateInputValue(sprint?.endDate),
    taskIds: sprint ? tasks.filter((t) => t.sprintId === sprint.id).map((t) => t.id) : [],
  }))
  const [sortByPriority, setSortByPriority] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const isEditing = sprint !== null

  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])

  // Tarefas disponíveis: sem sprint, ou já nesta sprint (na edição).
  const candidates = useMemo(() => {
    const list = tasks.filter((t) => t.sprintId === null || (sprint && t.sprintId === sprint.id))
    return sortByPriority ? sortTasksByPriority(list) : list
  }, [tasks, sprint, sortByPriority])

  const invalidPeriod =
    draft.startDate && draft.endDate && draft.endDate < draft.startDate
  const canSave =
    draft.name.trim().length > 0 &&
    draft.startDate.length > 0 &&
    draft.endDate.length > 0 &&
    !invalidPeriod &&
    draft.taskIds.length > 0 &&
    !isSaving

  function toggleTask(id: string, checked: boolean) {
    setDraft((d) => ({
      ...d,
      taskIds: checked ? [...d.taskIds, id] : d.taskIds.filter((t) => t !== id),
    }))
  }

  async function save() {
    if (draft.taskIds.length === 0) {
      toast.error("Selecione ao menos uma tarefa para compor a sprint.")
      return
    }
    if (!canSave) return

    setIsSaving(true)
    try {
      const url = isEditing
        ? `/api/projects/${projectId}/sprints/${sprint.id}`
        : `/api/projects/${projectId}/sprints`
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          goal: draft.goal.trim() || null,
          startDate: draft.startDate,
          endDate: draft.endDate,
          taskIds: draft.taskIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar sprint")
      toast.success(isEditing ? "Sprint atualizada." : "Sprint planejada.")
      onSaved()
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar sprint.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar sprint" : "Planejar sprint"}</DialogTitle>
          <DialogDescription>
            Defina o período, o objetivo e selecione as tarefas que serão executadas no ciclo.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="sprint-name">Nome</FieldLabel>
            <Input
              id="sprint-name"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Ex.: Sprint 1 — Locomoção"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="sprint-goal">Objetivo</FieldLabel>
            <Textarea
              id="sprint-goal"
              rows={2}
              value={draft.goal}
              onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value }))}
              placeholder="O que a sprint deve entregar (opcional)"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="sprint-start">Início</FieldLabel>
              <Input
                id="sprint-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sprint-end">Término</FieldLabel>
              <Input
                id="sprint-end"
                type="date"
                value={draft.endDate}
                min={draft.startDate || undefined}
                aria-invalid={!!invalidPeriod}
                onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
              />
            </Field>
          </div>
          {invalidPeriod && (
            <p className="-mt-2 text-xs text-destructive">
              A data de término deve ser igual ou posterior à de início.
            </p>
          )}

          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>
                Tarefas da sprint{" "}
                <span className="font-normal text-muted-foreground">
                  ({draft.taskIds.length} selecionada(s))
                </span>
              </FieldLabel>
              <Button
                type="button"
                size="sm"
                variant={sortByPriority ? "secondary" : "ghost"}
                className="gap-1.5"
                onClick={() => setSortByPriority((v) => !v)}
                aria-pressed={sortByPriority}
              >
                <ArrowDownWideNarrowIcon className="size-4" />
                Por prioridade
              </Button>
            </div>

            {candidates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                Não há tarefas disponíveis. Crie tarefas no Kanban ou libere tarefas de outras
                sprints.
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1">
                {candidates.map((task) => {
                  const checked = draft.taskIds.includes(task.id)
                  const column = columnById.get(task.columnId)
                  return (
                    <li key={task.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60",
                          checked && "bg-primary/5"
                        )}
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={checked}
                          onCheckedChange={(v) => toggleTask(task.id, v === true)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{task.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <PriorityIndicator value={task.priority} />
                            {column && <Badge variant="outline" className="text-[10px] font-normal">{column.name}</Badge>}
                            {task.requirement && (
                              <span className="font-mono">{task.requirement.code}</span>
                            )}
                            {task.assignee && <span>{task.assignee}</span>}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="ghost" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={save}>
            {isSaving ? "Salvando..." : isEditing ? "Salvar" : "Planejar sprint"}
          </Button>
        </DialogFooter>
    </>
  )
}
