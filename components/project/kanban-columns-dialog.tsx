"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { KanbanColumn, Task } from "@/lib/kanban"
import { cn } from "@/lib/utils"

const MAX_COLUMNS = 8

interface ColumnDraft {
  name: string
  isDone: boolean
  wipLimit: string
}

// Configuração das colunas do quadro (RF05): renomear, reordenar, marcar como "concluída",
// definir limite WIP, adicionar e excluir (realocando as tarefas).
interface KanbanColumnsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  columns: KanbanColumn[]
  tasks: Task[]
  onChanged: () => void
}

export function KanbanColumnsDialog(props: KanbanColumnsDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <KanbanColumnsEditor {...props} />
      </DialogContent>
    </Dialog>
  )
}

// Estado de edição em componente interno: o DialogContent desmonta ao fechar, então
// edições/exclusões pendentes são descartadas automaticamente.
function KanbanColumnsEditor({ projectId, columns, tasks, onChanged }: KanbanColumnsDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ColumnDraft>({ name: "", isDone: false, wipLimit: "" })
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [moveTo, setMoveTo] = useState<string>("")
  const [isBusy, setIsBusy] = useState(false)

  const countByColumn = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.columnId] = (acc[t.columnId] ?? 0) + 1
    return acc
  }, {})

  async function request(url: string, init: RequestInit, fallback: string) {
    setIsBusy(true)
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || fallback)
      onChanged()
      return true
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : fallback)
      return false
    } finally {
      setIsBusy(false)
    }
  }

  function startEdit(column: KanbanColumn) {
    setIsAdding(false)
    setDeletingId(null)
    setEditingId(column.id)
    setDraft({
      name: column.name,
      isDone: column.isDone,
      wipLimit: column.wipLimit ? String(column.wipLimit) : "",
    })
  }

  function startAdd() {
    setEditingId(null)
    setDeletingId(null)
    setIsAdding(true)
    setDraft({ name: "", isDone: false, wipLimit: "" })
  }

  async function saveDraft() {
    const name = draft.name.trim()
    if (!name) return
    const body = JSON.stringify({
      name,
      isDone: draft.isDone,
      wipLimit: draft.wipLimit.trim() ? Number(draft.wipLimit) : null,
    })

    const ok = isAdding
      ? await request(`/api/projects/${projectId}/columns`, { method: "POST", body }, "Erro ao criar coluna")
      : await request(
          `/api/projects/${projectId}/columns/${editingId}`,
          { method: "PATCH", body },
          "Erro ao atualizar coluna"
        )

    if (ok) {
      setIsAdding(false)
      setEditingId(null)
      toast.success(isAdding ? "Coluna criada." : "Coluna atualizada.")
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= columns.length) return
    const ids = columns.map((c) => c.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await request(
      `/api/projects/${projectId}/columns`,
      { method: "PUT", body: JSON.stringify({ columnIds: ids }) },
      "Erro ao reordenar colunas"
    )
  }

  function startDelete(column: KanbanColumn) {
    setIsAdding(false)
    setEditingId(null)
    setDeletingId(column.id)
    const firstOther = columns.find((c) => c.id !== column.id)
    setMoveTo(firstOther?.id ?? "")
  }

  async function confirmDelete() {
    if (!deletingId) return
    const hasTasks = (countByColumn[deletingId] ?? 0) > 0
    const query = hasTasks && moveTo ? `?moveTo=${moveTo}` : ""
    const ok = await request(
      `/api/projects/${projectId}/columns/${deletingId}${query}`,
      { method: "DELETE" },
      "Erro ao excluir coluna"
    )
    if (ok) {
      setDeletingId(null)
      toast.success("Coluna excluída.")
    }
  }

  function renderDraftForm() {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <Input
          autoFocus
          placeholder="Nome da coluna"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void saveDraft()
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.isDone}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, isDone: v === true }))}
            />
            Conta como concluída
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Limite WIP</span>
            <Input
              type="number"
              min={1}
              className="h-8 w-20"
              placeholder="—"
              value={draft.wipLimit}
              onChange={(e) => setDraft((d) => ({ ...d, wipLimit: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={isBusy}
            onClick={() => {
              setIsAdding(false)
              setEditingId(null)
            }}
          >
            <XIcon className="size-4" />
            Cancelar
          </Button>
          <Button size="sm" disabled={isBusy || !draft.name.trim()} onClick={saveDraft}>
            <CheckIcon className="size-4" />
            Salvar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>Colunas do quadro</DialogTitle>
          <DialogDescription>
            Cada coluna representa um estado do fluxo. Colunas marcadas como concluídas contam
            para o progresso do projeto e das sprints.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2">
          {columns.map((column, index) => {
            const count = countByColumn[column.id] ?? 0

            if (editingId === column.id) {
              return <li key={column.id}>{renderDraftForm()}</li>
            }

            if (deletingId === column.id) {
              const others = columns.filter((c) => c.id !== column.id)
              return (
                <li
                  key={column.id}
                  className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
                >
                  <p className="text-sm">
                    Excluir <span className="font-medium">{column.name}</span>?
                    {count > 0 && (
                      <>
                        {" "}
                        Há {count} tarefa(s) nela — escolha para onde movê-las:
                      </>
                    )}
                  </p>
                  {count > 0 && (
                    <Select value={moveTo} onValueChange={setMoveTo}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Coluna de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {others.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setDeletingId(null)}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isBusy || (count > 0 && !moveTo)}
                      onClick={confirmDelete}
                    >
                      Excluir coluna
                    </Button>
                  </div>
                </li>
              )
            }

            return (
              <li
                key={column.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="flex flex-col">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    disabled={isBusy || index === 0}
                    aria-label="Mover para cima"
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    disabled={isBusy || index === columns.length - 1}
                    aria-label="Mover para baixo"
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownIcon className="size-3.5" />
                  </Button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{column.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {count} tarefa(s)
                    {column.wipLimit ? ` · WIP ${column.wipLimit}` : ""}
                    {column.isDone ? " · concluída" : ""}
                  </p>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={isBusy}
                  aria-label={`Editar ${column.name}`}
                  onClick={() => startEdit(column)}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  )}
                  disabled={isBusy || columns.length <= 1}
                  aria-label={`Excluir ${column.name}`}
                  onClick={() => startDelete(column)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </li>
            )
          })}

          {isAdding && <li>{renderDraftForm()}</li>}
        </ul>

        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            disabled={isBusy || columns.length >= MAX_COLUMNS}
            onClick={startAdd}
          >
            <PlusIcon className="size-4" />
            Adicionar coluna
          </Button>
        )}
    </>
  )
}
