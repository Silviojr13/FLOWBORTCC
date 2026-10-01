"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  CalendarIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { HELP, HelpLabel } from "@/components/help-tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { PriorityIndicator } from "@/components/project-manual/requirement-indicators"
import {
  TASK_PRIORITIES,
  formatDate,
  isTaskOverdue,
  toDateInputValue,
  type KanbanColumn,
  type Sprint,
  type Task,
  type TaskPriority,
  type TaskRequirementRef,
} from "@/lib/kanban"
import { cn } from "@/lib/utils"

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

function draftsEqual(a: TaskDraft, b: TaskDraft) {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.priority === b.priority &&
    a.assignee === b.assignee &&
    a.dueDate === b.dueDate &&
    a.columnId === b.columnId &&
    a.requirementId === b.requirementId &&
    a.featureId === b.featureId &&
    a.sprintId === b.sprintId
  )
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function columnVisual(column: KanbanColumn, index: number) {
  if (column.isDone) {
    return { Icon: CheckCircle2Icon, className: "text-emerald-600 dark:text-emerald-400" }
  }
  const name = column.name.toLowerCase()
  if (name.includes("revis")) {
    return { Icon: CircleDotIcon, className: "text-primary" }
  }
  if (name.includes("progress") || name.includes("andamento") || name.includes("fazendo")) {
    return { Icon: LoaderCircleIcon, className: "text-amber-600 dark:text-amber-400" }
  }
  if (index === 0 || name.includes("backlog") || name.includes("a fazer")) {
    return { Icon: CircleIcon, className: "text-muted-foreground" }
  }
  return { Icon: CircleDotIcon, className: "text-primary" }
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
  onHistory?: (task: Task) => void
  onDelete?: (task: Task) => void
}

const quietControl =
  "h-9 w-full border-transparent bg-transparent shadow-none hover:border-border hover:bg-background focus-visible:border-ring"

export function TaskDialog(props: TaskDialogProps) {
  if (!props.open) return null
  return <TaskDialogSession key={props.task?.id ?? "new"} {...props} />
}

function TaskDialogSession({
  open,
  onOpenChange,
  projectId,
  task,
  columns,
  requirements,
  features,
  sprints,
  defaultColumnId,
  onSaved,
  onHistory,
  onDelete,
}: TaskDialogProps) {
  const fallbackColumn = defaultColumnId ?? columns[0]?.id ?? ""
  const initial = draftFromTask(task, fallbackColumn)
  const [draft, setDraft] = useState<TaskDraft>(initial)
  const [baseline, setBaseline] = useState<TaskDraft>(initial)
  const [isSaving, setIsSaving] = useState(false)
  const [titleEditing, setTitleEditing] = useState(task === null)

  const isEditing = task !== null
  const dirty = !draftsEqual(draft, baseline)
  const canSave = draft.title.trim().length > 0 && draft.columnId.length > 0 && !isSaving
  const selectedColumn = columns.find((column) => column.id === draft.columnId)
  const overdue = isTaskOverdue(
    { dueDate: draft.dueDate ? `${draft.dueDate}T00:00:00.000Z` : null },
    selectedColumn?.isDone ?? false
  )
  const selectedRequirement =
    draft.requirementId === NONE
      ? null
      : requirements.find((item) => item.id === draft.requirementId) ?? task?.requirement ?? null
  const selectedFeature =
    draft.featureId === NONE
      ? null
      : features.find((item) => item.id === draft.featureId) ?? task?.feature ?? null

  function update(patch: Partial<TaskDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function requestClose() {
    if (dirty && !window.confirm("Descartar as alterações não salvas?")) return
    onOpenChange(false)
  }

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
      const saved = draftFromTask(data.task, fallbackColumn)
      setDraft(saved)
      setBaseline(saved)
      onSaved(data.task)
      toast.success(isEditing ? "Tarefa atualizada." : "Tarefa criada.")
      if (!isEditing) onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar tarefa.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
      <DialogContent
        showCloseButton={false}
        className="h-[min(88vh,860px)] w-[min(1100px,calc(100vw-1.5rem))] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">
          {isEditing ? "Detalhe da tarefa" : "Nova tarefa"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isEditing
            ? "Consulte e edite o conteúdo e as propriedades desta tarefa."
            : "Preencha o conteúdo e as propriedades da nova tarefa."}
        </DialogDescription>

        <header className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-primary">{isEditing ? "Tarefa" : "Nova tarefa"}</p>
            {titleEditing ? (
              <input
                autoFocus
                aria-label="Título da tarefa"
                value={draft.title}
                placeholder="Título da tarefa"
                onChange={(event) => update({ title: event.target.value })}
                onBlur={() => {
                  if (isEditing && !draft.title.trim()) update({ title: baseline.title })
                  if (isEditing) setTitleEditing(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                  if (event.key === "Escape") {
                    event.preventDefault()
                    event.stopPropagation()
                    update({ title: baseline.title })
                    setTitleEditing(false)
                  }
                }}
                className="mt-1 w-full bg-transparent text-xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground sm:text-2xl"
              />
            ) : (
              <button
                type="button"
                className="mt-1 w-full rounded-md text-left text-xl font-semibold tracking-tight text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-2xl"
                onClick={() => setTitleEditing(true)}
              >
                {draft.title}
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isEditing && task && (onHistory || onDelete) ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Ações da tarefa"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onHistory ? (
                    <DropdownMenuItem onClick={() => onHistory(task)}>
                      Histórico
                    </DropdownMenuItem>
                  ) : null}
                  {onDelete ? (
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
                      Excluir
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar"
              onClick={requestClose}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <TaskMainContent
            draft={draft}
            requirements={requirements}
            features={features}
            selectedRequirement={selectedRequirement}
            selectedFeature={selectedFeature}
            onChange={update}
          />
          <TaskProperties
            draft={draft}
            columns={columns}
            sprints={sprints}
            overdue={overdue}
            onChange={update}
          />
        </div>

        {(!isEditing || dirty) && (
          <footer className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {isEditing ? (
              <p className="mr-auto text-xs text-muted-foreground">Alterações não salvas</p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving}
              onClick={() => (isEditing ? setDraft(baseline) : requestClose())}
            >
              {isEditing ? "Descartar alterações" : "Cancelar"}
            </Button>
            <Button type="button" disabled={!canSave} onClick={() => void save()}>
              {isSaving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar tarefa"}
            </Button>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-medium text-foreground">{children}</div>
}

function TaskMainContent({
  draft,
  requirements,
  features,
  selectedRequirement,
  selectedFeature,
  onChange,
}: {
  draft: TaskDraft
  requirements: TaskRequirementRef[]
  features: { id: string; name: string }[]
  selectedRequirement: TaskRequirementRef | null
  selectedFeature: { id: string; name: string } | null
  onChange: (patch: Partial<TaskDraft>) => void
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 px-5 py-5 sm:px-6 lg:overflow-y-auto">
      <section className="flex flex-col gap-2">
        <SectionLabel>Descrição</SectionLabel>
        <textarea
          aria-label="Descrição"
          value={draft.description}
          rows={8}
          placeholder="Adicione uma descrição..."
          onChange={(event) => onChange({ description: event.target.value })}
          className="min-h-40 w-full resize-y rounded-lg border border-transparent bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground hover:bg-muted/50 focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/40"
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="text-sm font-medium text-foreground">
          <HelpLabel label="Requisito" content={HELP.traceability}>
            Requisito relacionado
          </HelpLabel>
        </div>
        {selectedRequirement ? (
          <div className="flex flex-col gap-1.5">
            <Badge variant="secondary" className="w-fit font-mono text-[11px] font-normal">
              {selectedRequirement.code}
            </Badge>
            <p className="text-sm leading-relaxed text-foreground">{selectedRequirement.description}</p>
            {selectedRequirement.status === "Descartado" ? (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Este requisito foi descartado.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum requisito relacionado</p>
        )}
        <Select value={draft.requirementId} onValueChange={(value) => onChange({ requirementId: value })}>
          <SelectTrigger className={quietControl} aria-label="Alterar requisito relacionado">
            <SelectValue placeholder="Selecionar requisito">
              {selectedRequirement ? selectedRequirement.code : "Selecionar requisito"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhum requisito</SelectItem>
            {requirements.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
                <span className="truncate">{item.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="flex flex-col gap-2">
        <div className="text-sm font-medium text-foreground">
          <HelpLabel label="Funcionalidade" content={HELP.feature}>
            Funcionalidade
          </HelpLabel>
        </div>
        <p className={cn("text-sm", selectedFeature ? "text-foreground" : "text-muted-foreground")}>
          {selectedFeature?.name ?? "Nenhuma funcionalidade relacionada"}
        </p>
        <Select value={draft.featureId} onValueChange={(value) => onChange({ featureId: value })}>
          <SelectTrigger className={quietControl} aria-label="Alterar funcionalidade relacionada">
            <SelectValue placeholder="Selecionar funcionalidade">
              {selectedFeature?.name ?? "Nenhuma funcionalidade"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhuma funcionalidade</SelectItem>
            {features.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>
    </div>
  )
}

function TaskProperties({
  draft,
  columns,
  sprints,
  overdue,
  onChange,
}: {
  draft: TaskDraft
  columns: KanbanColumn[]
  sprints: Sprint[]
  overdue: boolean
  onChange: (patch: Partial<TaskDraft>) => void
}) {
  const dueLabel = draft.dueDate ? formatDate(`${draft.dueDate}T00:00:00.000Z`) : ""
  const selectedColumn = columns.find((column) => column.id === draft.columnId)

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border-t border-border bg-muted/70 px-5 py-5 lg:w-[34%] lg:overflow-y-auto lg:border-t-0 lg:border-l dark:bg-muted">
      <PropertyField label="Status">
        <Select value={draft.columnId} onValueChange={(value) => onChange({ columnId: value })}>
          <SelectTrigger className={quietControl} aria-label="Status">
            <SelectValue placeholder="Selecione">
              {selectedColumn ? (
                <ColumnStatus column={selectedColumn} index={columns.indexOf(selectedColumn)} />
              ) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {columns.map((column, index) => {
              const visual = columnVisual(column, index)
              const Icon = visual.Icon
              return (
                <SelectItem key={column.id} value={column.id}>
                  <Icon className={cn("size-3.5", visual.className)} aria-hidden />
                  {column.name}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </PropertyField>

      <PropertyField
        label={
          <HelpLabel label="Prioridade" content={HELP.priority}>
            Prioridade
          </HelpLabel>
        }
      >
        <Select
          value={draft.priority}
          onValueChange={(value) => onChange({ priority: value as TaskPriority })}
        >
          <SelectTrigger className={quietControl} aria-label="Prioridade">
            <SelectValue>
              <PriorityIndicator value={draft.priority} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                <PriorityIndicator value={priority} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PropertyField>

      <PropertyField label="Responsável">
        <label className="flex h-9 items-center gap-2 rounded-lg px-2 hover:bg-background">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            {initials(draft.assignee) || "—"}
          </span>
          <input
            aria-label="Responsável"
            value={draft.assignee}
            placeholder="Nome de quem executa"
            onChange={(event) => onChange({ assignee: event.target.value })}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </PropertyField>

      <PropertyField label="Prazo">
        <label
          className={cn(
            "relative flex h-9 items-center gap-2 rounded-lg px-2 hover:bg-background",
            overdue ? "font-medium text-destructive" : draft.dueDate ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">{dueLabel || "Definir prazo"}</span>
          {overdue ? <span className="text-xs">Vencida</span> : null}
          <input
            aria-label="Prazo"
            type="date"
            value={draft.dueDate}
            onChange={(event) => onChange({ dueDate: event.target.value })}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </PropertyField>

      <PropertyField
        label={
          <HelpLabel label="Sprint" content={HELP.sprint}>
            Sprint
          </HelpLabel>
        }
      >
        <Select value={draft.sprintId} onValueChange={(value) => onChange({ sprintId: value })}>
          <SelectTrigger className={quietControl} aria-label="Sprint">
            <SelectValue placeholder="Nenhuma">
              {draft.sprintId === NONE
                ? "Nenhuma"
                : sprints.find((sprint) => sprint.id === draft.sprintId)?.name ?? "Nenhuma"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhuma</SelectItem>
            {sprints.map((sprint) => (
              <SelectItem key={sprint.id} value={sprint.id}>
                {sprint.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PropertyField>
    </aside>
  )
}

function ColumnStatus({ column, index }: { column: KanbanColumn; index: number }) {
  const visual = columnVisual(column, index)
  const Icon = visual.Icon
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={cn("size-3.5", visual.className)} aria-hidden />
      {column.name}
    </span>
  )
}

function PropertyField({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}
