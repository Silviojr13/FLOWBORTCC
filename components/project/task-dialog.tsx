"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PriorityIndicator } from "@/components/project-manual/requirement-indicators"
import {
  TASK_PRIORITIES,
  toDateInputValue,
  type KanbanColumn,
  type Sprint,
  type Task,
  type TaskPriority,
  type TaskRequirementRef,
} from "@/lib/kanban"

// Radix Select não aceita valor vazio; usamos um sentinela para "nenhum".
const NONE = "__none__"

export interface TaskDraft {
  title: string
  description: string
  priority: TaskPriority
  assignee: string
  dueDate: string
  columnId: string
  requirementId: string
  featureId: string
  sprintId: string
}

function draftFromTask(task: Task | null, defaultColumnId: string): TaskDraft {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "Média",
    assignee: task?.assignee ?? "",
    dueDate: toDateInputValue(task?.dueDate),
    columnId: task?.columnId ?? defaultColumnId,
    requirementId: task?.requirementId ?? NONE,
    featureId: task?.featureId ?? NONE,
    sprintId: task?.sprintId ?? NONE,
  }
}

interface TaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  task: Task | null
  columns: KanbanColumn[]
  requirements: TaskRequirementRef[]
  features: { id: string; name: string }[]
  sprints: Sprint[]
  defaultColumnId?: string
  onSaved: (task: Task) => void
}

// Dialog de criar/editar tarefa (RF06 / UC05). `task` nulo = criação.
// O formulário vive num componente interno: o DialogContent desmonta ao fechar, então o
// rascunho reinicia a cada abertura sem precisar de efeito.
export function TaskDialog(props: TaskDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <TaskDialogForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function TaskDialogForm({
  onOpenChange,
  projectId,
  task,
  columns,
  requirements,
  features,
  sprints,
  defaultColumnId,
  onSaved,
}: TaskDialogProps) {
  const fallbackColumn = defaultColumnId ?? columns[0]?.id ?? ""
  const [draft, setDraft] = useState<TaskDraft>(() => draftFromTask(task, fallbackColumn))
  const [isSaving, setIsSaving] = useState(false)

  const isEditing = task !== null
  const canSave = draft.title.trim().length > 0 && draft.columnId.length > 0 && !isSaving

  async function save() {
    if (!canSave) return

    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      priority: draft.priority,
      assignee: draft.assignee.trim() || null,
      dueDate: draft.dueDate || null,
      columnId: draft.columnId,
      requirementId: draft.requirementId === NONE ? null : draft.requirementId,
      featureId: draft.featureId === NONE ? null : draft.featureId,
      sprintId: draft.sprintId === NONE ? null : draft.sprintId,
    }

    setIsSaving(true)
    try {
      const url = isEditing
        ? `/api/projects/${projectId}/tasks/${task.id}`
        : `/api/projects/${projectId}/tasks`
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar tarefa")
      onSaved(data.task)
      toast.success(isEditing ? "Tarefa atualizada." : "Tarefa criada.")
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar tarefa.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription>
            Título é obrigatório. Vincule a tarefa a um requisito para manter a rastreabilidade.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="task-title">Título</FieldLabel>
            <Input
              id="task-title"
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Ex.: Calibrar sensor de distância"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void save()
                }
              }}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="task-description">Descrição</FieldLabel>
            <Textarea
              id="task-description"
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Detalhes, critérios de aceite, observações (opcional)"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Prioridade</FieldLabel>
              <Select
                value={draft.priority}
                onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as TaskPriority }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      <PriorityIndicator value={p} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Coluna</FieldLabel>
              <Select
                value={draft.columnId}
                onValueChange={(v) => setDraft((d) => ({ ...d, columnId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="task-assignee">Responsável</FieldLabel>
              <Input
                id="task-assignee"
                value={draft.assignee}
                onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                placeholder="Nome de quem executa"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="task-due">Prazo</FieldLabel>
              <Input
                id="task-due"
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Requisito</FieldLabel>
            <Select
              value={draft.requirementId}
              onValueChange={(v) => setDraft((d) => ({ ...d, requirementId: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {requirements.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                    <span className="truncate">{r.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Funcionalidade</FieldLabel>
              <Select
                value={draft.featureId}
                onValueChange={(v) => setDraft((d) => ({ ...d, featureId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {features.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Sprint</FieldLabel>
              <Select
                value={draft.sprintId}
                onValueChange={(v) => setDraft((d) => ({ ...d, sprintId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {sprints.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FieldGroup>

        <DialogFooter>
          <Button variant="ghost" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={save}>
            {isSaving ? "Salvando..." : isEditing ? "Salvar" : "Criar tarefa"}
          </Button>
        </DialogFooter>
    </>
  )
}
