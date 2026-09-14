"use client"

import { useEffect, useState } from "react"
import { ArrowRightIcon, HistoryIcon } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Task, TaskHistoryEntry } from "@/lib/kanban"

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Histórico de movimentação da tarefa entre colunas (RF09).
export function TaskHistorySheet({
  projectId,
  task,
  onOpenChange,
}: {
  projectId: string
  task: Task | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={task !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HistoryIcon className="size-4" aria-hidden />
            Histórico da tarefa
          </SheetTitle>
          <SheetDescription>{task?.title}</SheetDescription>
        </SheetHeader>

        {task && <TaskHistoryList key={task.id} projectId={projectId} taskId={task.id} />}
      </SheetContent>
    </Sheet>
  )
}

function TaskHistoryList({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [history, setHistory] = useState<TaskHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/projects/${projectId}/tasks/${taskId}/history`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao carregar histórico")
        if (!cancelled) setHistory(data.history)
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) setHistory([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [projectId, taskId])

  return (
        <div className="px-4 pb-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando histórico...</p>}

          {!isLoading && history.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
          )}

          {!isLoading && history.length > 0 && (
            <ol className="relative flex flex-col gap-4 border-l border-border pl-4">
              {history.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
                  <p className="flex flex-wrap items-center gap-1.5 text-sm">
                    {entry.fromColumn ? (
                      <>
                        <span className="text-muted-foreground">{entry.fromColumn}</span>
                        <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden />
                        <span className="font-medium">{entry.toColumn}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Criada em</span>
                        <span className="font-medium">{entry.toColumn}</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(entry.changedAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
  )
}
