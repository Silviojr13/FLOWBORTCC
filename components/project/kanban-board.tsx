"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableSyntheticListeners,
  type CollisionDetection,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import {
  AlertTriangleIcon,
  ArrowDownWideNarrowIcon,
  CalendarIcon,
  CircleDashedIcon,
  GripVerticalIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PriorityIndicator } from "@/components/project-manual/requirement-indicators"
import { KanbanColumnsDialog } from "@/components/project/kanban-columns-dialog"
import { TaskDialog } from "@/components/project/task-dialog"
import { TaskHistorySheet } from "@/components/project/task-history-sheet"
import {
  TASK_PRIORITIES,
  formatDate,
  isTaskOverdue,
  sortTasksByPriority,
  type KanbanColumn,
  type Sprint,
  type Task,
  type TaskPriority,
  type TaskRequirementRef,
} from "@/lib/kanban"
import { cn } from "@/lib/utils"

const ALL = "__all__"
const NO_ASSIGNEE = "__none__"

// Onde soltar: primeiro o card sob o ponteiro (inserir naquela posição), senão a coluna sob o
// ponteiro; se o ponteiro estiver fora de tudo, cai nas heurísticas geométricas do dnd-kit.
const kanbanCollision: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  if (underPointer.length > 0) {
    const card = underPointer.find((c) => c.data?.droppableContainer?.data?.current?.type === "task")
    return card ? [card] : [underPointer[0]]
  }
  const intersecting = rectIntersection(args)
  return intersecting.length > 0 ? intersecting : closestCorners(args)
}

interface Filters {
  assignee: string
  priority: string
  sprint: string
  requirement: string
}

const EMPTY_FILTERS: Filters = { assignee: ALL, priority: ALL, sprint: ALL, requirement: ALL }

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

function TaskCardContent({
  task,
  columns,
  isDone,
  isDragging,
  dragHandleProps,
  onMove,
  onEdit,
  onHistory,
  onDelete,
}: {
  task: Task
  columns: KanbanColumn[]
  isDone: boolean
  isDragging?: boolean
  dragHandleProps?: DraggableSyntheticListeners
  onMove: (taskId: string, columnId: string) => void
  onEdit: (task: Task) => void
  onHistory: (task: Task) => void
  onDelete: (task: Task) => void
}) {
  const overdue = isTaskOverdue(task, isDone)

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow",
        isDragging && "opacity-40",
        overdue && "border-destructive/50"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Arrastar ${task.title}`}
          {...dragHandleProps}
        >
          <GripVerticalIcon className="size-4" />
        </button>

        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onEdit(task)}
        >
          <p className={cn("text-sm font-medium leading-snug", isDone && "text-muted-foreground line-through")}>
            {task.title}
          </p>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="-mr-1 -mt-1 size-7 shrink-0 text-muted-foreground"
              aria-label="Ações da tarefa"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <PencilIcon className="size-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onHistory(task)}>
              <HistoryIcon className="size-4" />
              Histórico
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
              <Trash2Icon className="size-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-6 text-xs">
        <PriorityIndicator value={task.priority} />

        {task.requirement && (
          <Badge variant="secondary" className="font-mono text-[10px] font-normal" title={task.requirement.description}>
            {task.requirement.code}
          </Badge>
        )}

        {task.sprint && (
          <Badge variant="outline" className="text-[10px] font-normal">
            {task.sprint.name}
          </Badge>
        )}

        {task.dueDate && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-muted-foreground",
              overdue && "font-medium text-destructive"
            )}
            title={overdue ? "Prazo vencido" : "Prazo"}
          >
            {overdue ? (
              <AlertTriangleIcon className="size-3.5" aria-hidden />
            ) : (
              <CalendarIcon className="size-3.5" aria-hidden />
            )}
            {formatDate(task.dueDate)}
          </span>
        )}

        {task.assignee && (
          <span className="inline-flex items-center gap-1 text-muted-foreground" title={task.assignee}>
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {initials(task.assignee) || <UserIcon className="size-3" />}
            </span>
            <span className="max-w-[9rem] truncate">{task.assignee}</span>
          </span>
        )}
      </div>

      {task.feature && (
        <p className="mt-1.5 pl-6 text-[11px] text-muted-foreground">
          Funcionalidade: {task.feature.name}
        </p>
      )}

      <div className="mt-3 pl-6">
        <Select value={task.columnId} onValueChange={(columnId) => onMove(task.id, columnId)}>
          <SelectTrigger size="sm" className="w-full min-w-[10rem]" aria-label="Mover para coluna">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {columns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function DraggableTaskCard(props: Parameters<typeof TaskCardContent>[0]) {
  const { task } = props
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { type: "task", task },
  })
  // O card também é área de soltura: soltar sobre ele insere a tarefa arrastada na posição dele.
  const { setNodeRef: setDropRef } = useDroppable({ id: task.id, data: { type: "task", task } })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={(node) => {
        setDragRef(node)
        setDropRef(node)
      }}
      style={style}
      {...attributes}
    >
      <TaskCardContent {...props} isDragging={isDragging} dragHandleProps={listeners} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Column                                                             */
/* ------------------------------------------------------------------ */

function KanbanColumnView({
  column,
  tasks,
  columns,
  onAdd,
  cardProps,
}: {
  column: KanbanColumn
  tasks: Task[]
  columns: KanbanColumn[]
  onAdd: (columnId: string) => void
  cardProps: Omit<Parameters<typeof TaskCardContent>[0], "task" | "columns" | "isDone">
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column" } })
  const overLimit = column.wipLimit !== null && tasks.length > column.wipLimit

  return (
    <div
      className={cn(
        "flex min-h-[240px] w-[280px] shrink-0 snap-center flex-col rounded-xl border border-border bg-muted/15",
        column.isDone ? "border-t-2 border-t-emerald-500/60" : "border-t-2 border-t-primary/40",
        isOver && "ring-2 ring-primary/25 ring-offset-1 ring-offset-background"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <p className="truncate text-sm font-medium">{column.name}</p>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground",
              overLimit && "bg-destructive/10 font-medium text-destructive"
            )}
            title={
              column.wipLimit
                ? overLimit
                  ? `Limite WIP de ${column.wipLimit} excedido`
                  : `Limite WIP: ${column.wipLimit}`
                : undefined
            }
          >
            {tasks.length}
            {column.wipLimit ? `/${column.wipLimit}` : ""}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 text-muted-foreground"
            aria-label={`Nova tarefa em ${column.name}`}
            onClick={() => onAdd(column.id)}
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <div ref={setNodeRef} className="flex flex-1 flex-col gap-2 p-2">
        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 px-3 py-6 text-center">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleDashedIcon className="size-3.5" aria-hidden />
              Nenhuma tarefa aqui
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              columns={columns}
              isDone={column.isDone}
              {...cardProps}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Board                                                              */
/* ------------------------------------------------------------------ */

export function KanbanBoard({ projectId }: { projectId: string }) {
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [requirements, setRequirements] = useState<TaskRequirementRef[]>([])
  const [features, setFeatures] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sortByPriority, setSortByPriority] = useState(false)

  const [dialogTask, setDialogTask] = useState<Task | null>(null)
  const [dialogColumnId, setDialogColumnId] = useState<string | undefined>(undefined)
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [historyTask, setHistoryTask] = useState<Task | null>(null)
  const [isColumnsDialogOpen, setIsColumnsDialogOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  )

  // Recarrega o quadro do servidor (após mutações, para refletir ordem/histórico/sprints).
  const load = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false

    async function fetchBoard() {
      try {
        const [kanbanRes, reqRes, featRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/kanban`),
          fetch(`/api/projects/${projectId}/requirements`),
          fetch(`/api/projects/${projectId}/features`),
        ])
        const kanban = await kanbanRes.json()
        if (!kanbanRes.ok) throw new Error(kanban.error || "Erro ao carregar Kanban")
        if (cancelled) return
        setColumns(kanban.columns)
        setTasks(kanban.tasks)
        setSprints(kanban.sprints)
        if (reqRes.ok) setRequirements((await reqRes.json()).requirements)
        if (featRes.ok) setFeatures((await featRes.json()).features)
      } catch (error) {
        console.error(error)
        toast.error(error instanceof Error ? error.message : "Não foi possível carregar o Kanban.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void fetchBoard()
    return () => {
      cancelled = true
    }
  }, [projectId, refreshKey])

  /* ---- filtros (UC06 fluxo alternativo) ---- */

  const assignees = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.assignee).filter((a): a is string => !!a))).sort(),
    [tasks]
  )

  const hasActiveFilter = Object.values(filters).some((v) => v !== ALL)

  const visibleTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (filters.assignee !== ALL) {
          if (filters.assignee === NO_ASSIGNEE ? t.assignee !== null : t.assignee !== filters.assignee) return false
        }
        if (filters.priority !== ALL && t.priority !== filters.priority) return false
        if (filters.sprint !== ALL) {
          if (filters.sprint === NO_ASSIGNEE ? t.sprintId !== null : t.sprintId !== filters.sprint) return false
        }
        if (filters.requirement !== ALL && t.requirementId !== filters.requirement) return false
        return true
      }),
    [tasks, filters]
  )

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const c of columns) map[c.id] = []
    for (const t of visibleTasks) map[t.columnId]?.push(t)
    for (const id of Object.keys(map)) {
      map[id] = sortByPriority
        ? sortTasksByPriority(map[id])
        : [...map[id]].sort((a, b) => a.order - b.order)
    }
    return map
  }, [columns, visibleTasks, sortByPriority])

  /* ---- ações ---- */

  function upsertTask(task: Task) {
    setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task]))
  }

  function openCreate(columnId?: string) {
    setDialogTask(null)
    setDialogColumnId(columnId)
    setIsTaskDialogOpen(true)
  }

  function openEdit(task: Task) {
    setDialogTask(task)
    setDialogColumnId(undefined)
    setIsTaskDialogOpen(true)
  }

  function warnWipIfNeeded(columnId: string, extra: number) {
    const column = columns.find((c) => c.id === columnId)
    if (!column?.wipLimit) return
    const count = tasks.filter((t) => t.columnId === columnId).length + extra
    if (count > column.wipLimit) {
      toast.warning(`Limite WIP de "${column.name}" (${column.wipLimit}) excedido.`)
    }
  }

  // Ação manual pelo select (RF07).
  async function moveTask(taskId: string, columnId: string) {
    const current = tasks.find((t) => t.id === taskId)
    if (!current || current.columnId === columnId) return
    const previous = current

    warnWipIfNeeded(columnId, 1)
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, columnId } : t)))

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao mover tarefa")
      upsertTask(data.task)
      load()
    } catch (error) {
      console.error(error)
      setTasks((prev) => prev.map((t) => (t.id === taskId ? previous : t)))
      toast.error(error instanceof Error ? error.message : "Erro ao mover tarefa.")
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Excluir a tarefa "${task.title}"?`)) return
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao excluir tarefa")
      }
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      toast.success("Tarefa excluída.")
      load()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir tarefa.")
    }
  }

  /* ---- drag-and-drop (RF07) ---- */

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const taskId = String(active.id)
    const overId = String(over.id)
    const dragged = tasks.find((t) => t.id === taskId)
    if (!dragged) return

    const overColumn = columns.find((c) => c.id === overId)
    const overTask = overColumn ? null : tasks.find((t) => t.id === overId)
    const targetColumnId = overColumn?.id ?? overTask?.columnId
    if (!targetColumnId) return

    // Ordem final da coluna de destino (sem a tarefa arrastada), depois insere na posição.
    const targetIds = (grouped[targetColumnId] ?? []).map((t) => t.id).filter((id) => id !== taskId)
    const insertAt = overTask ? targetIds.indexOf(overTask.id) : targetIds.length
    targetIds.splice(insertAt < 0 ? targetIds.length : insertAt, 0, taskId)

    if (dragged.columnId === targetColumnId && targetIds.join() === (grouped[targetColumnId] ?? []).map((t) => t.id).join()) {
      return
    }

    if (dragged.columnId !== targetColumnId) warnWipIfNeeded(targetColumnId, 1)

    const snapshot = tasks
    setTasks((prev) =>
      prev.map((t) => {
        const idx = targetIds.indexOf(t.id)
        if (idx === -1) return t
        return { ...t, columnId: targetColumnId, order: idx }
      })
    )

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId: targetColumnId, taskIds: targetIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao mover tarefa")
      }
      load()
    } catch (error) {
      console.error(error)
      setTasks(snapshot)
      toast.error(error instanceof Error ? error.message : "Erro ao mover tarefa.")
    }
  }

  /* ---- render ---- */

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando Kanban...</p>
  }

  const cardProps = {
    onMove: moveTask,
    onEdit: openEdit,
    onHistory: setHistoryTask,
    onDelete: deleteTask,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de ações e filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={() => openCreate()}>
          <PlusIcon className="size-4" />
          Nova tarefa
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsColumnsDialogOpen(true)}>
          <Settings2Icon className="size-4" />
          Colunas
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <Link href={`/dashboard/projects/${projectId}/sprints`}>
            <CalendarIcon className="size-4" />
            Sprints
          </Link>
        </Button>
        <Button
          size="sm"
          variant={sortByPriority ? "secondary" : "ghost"}
          className="gap-1.5"
          onClick={() => setSortByPriority((v) => !v)}
          aria-pressed={sortByPriority}
        >
          <ArrowDownWideNarrowIcon className="size-4" />
          Ordenar por prioridade
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.assignee} onValueChange={(v) => setFilters((f) => ({ ...f, assignee: v }))}>
          <SelectTrigger size="sm" className="min-w-[10rem]" aria-label="Filtrar por responsável">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
            <SelectItem value={NO_ASSIGNEE}>Sem responsável</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.priority} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
          <SelectTrigger size="sm" className="min-w-[9rem]" aria-label="Filtrar por prioridade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as prioridades</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                <PriorityIndicator value={p as TaskPriority} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.sprint} onValueChange={(v) => setFilters((f) => ({ ...f, sprint: v }))}>
          <SelectTrigger size="sm" className="min-w-[9rem]" aria-label="Filtrar por sprint">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as sprints</SelectItem>
            <SelectItem value={NO_ASSIGNEE}>Sem sprint</SelectItem>
            {sprints.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {requirements.length > 0 && (
          <Select value={filters.requirement} onValueChange={(v) => setFilters((f) => ({ ...f, requirement: v }))}>
            <SelectTrigger size="sm" className="min-w-[9rem]" aria-label="Filtrar por requisito">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os requisitos</SelectItem>
              {requirements.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="font-mono text-xs">{r.code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilter && (
          <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => setFilters(EMPTY_FILTERS)}>
            <XIcon className="size-3.5" />
            Limpar filtros
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {visibleTasks.length} de {tasks.length} tarefa(s)
        </span>
      </div>

      {tasks.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">Nenhuma tarefa ainda.</p>
          <p className="text-sm text-muted-foreground">
            Crie tarefas vinculadas aos requisitos para acompanhar a execução do projeto.
          </p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          {columns.map((column) => (
            <KanbanColumnView
              key={column.id}
              column={column}
              columns={columns}
              tasks={grouped[column.id] ?? []}
              onAdd={openCreate}
              cardProps={cardProps}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="w-[280px] rotate-1 cursor-grabbing opacity-95 shadow-lg">
              <TaskCardContent
                task={activeTask}
                columns={columns}
                isDone={columns.find((c) => c.id === activeTask.columnId)?.isDone ?? false}
                onMove={() => {}}
                onEdit={() => {}}
                onHistory={() => {}}
                onDelete={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        projectId={projectId}
        task={dialogTask}
        columns={columns}
        requirements={requirements}
        features={features}
        sprints={sprints}
        defaultColumnId={dialogColumnId}
        onSaved={(task) => {
          upsertTask(task)
          load()
        }}
      />

      <TaskHistorySheet
        projectId={projectId}
        task={historyTask}
        onOpenChange={(open) => {
          if (!open) setHistoryTask(null)
        }}
      />

      <KanbanColumnsDialog
        open={isColumnsDialogOpen}
        onOpenChange={setIsColumnsDialogOpen}
        projectId={projectId}
        columns={columns}
        tasks={tasks}
        onChanged={() => load()}
      />
    </div>
  )
}
