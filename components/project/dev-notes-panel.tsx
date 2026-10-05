"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  HelpCircleIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  TerminalIcon,
  TrendingUpIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DEV_NOTE_KINDS, DEV_NOTE_LABELS, type DevNoteKind, type DevNoteView } from "@/lib/dev-notes"
import { cn } from "@/lib/utils"

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const KIND_STYLE: Record<DevNoteKind, { icon: typeof TrendingUpIcon; className: string }> = {
  progresso: { icon: TrendingUpIcon, className: "bg-primary/10 text-primary" },
  concluido: { icon: CheckCircle2Icon, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  problema: { icon: AlertTriangleIcon, className: "bg-destructive/10 text-destructive" },
  pergunta: { icon: HelpCircleIcon, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
}

/**
 * Aba Desenvolvimento: o andamento que o Claude Code registrou pelo servidor MCP. O mesmo
 * andamento entra no contexto do assistente do FlowBot, que sugere a continuidade.
 */
export function DevNotesPanel({ projectId }: { projectId: string }) {
  const [notes, setNotes] = useState<DevNoteView[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState<DevNoteKind | "todos">("todos")
  const [reloadToken, setReloadToken] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/projects/${projectId}/dev-notes`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || "Não foi possível carregar o andamento.")
        if (!cancelled) {
          setNotes(body.notes)
          setHasMore(body.hasMore)
        }
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível carregar o andamento.")
      })
    return () => {
      cancelled = true
    }
  }, [projectId, reloadToken])

  async function loadMore() {
    if (!notes || notes.length === 0 || loadingMore) return
    setLoadingMore(true)
    try {
      const before = encodeURIComponent(notes[notes.length - 1].createdAt)
      const res = await fetch(`/api/projects/${projectId}/dev-notes?antes=${before}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Não foi possível carregar mais registros.")
      setNotes((current) => [...(current ?? []), ...body.notes])
      setHasMore(body.hasMore)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar mais registros.")
    } finally {
      setLoadingMore(false)
    }
  }

  if (!notes) return <p className="text-sm text-muted-foreground">Carregando...</p>

  if (notes.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-10 text-center"
        data-tour="dev-notes"
      >
        <TerminalIcon className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-foreground">Nenhum andamento registrado ainda.</p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          Conecte o Claude Code ao FlowBot: ele lê as tarefas deste projeto, desenvolve o software e registra aqui o que
          fez, os problemas e as dúvidas. O assistente do FlowBot usa esses registros para sugerir os próximos passos.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/minhas-ias">Conectar o Claude Code</Link>
        </Button>
      </div>
    )
  }

  const counts = Object.fromEntries(DEV_NOTE_KINDS.map((k) => [k, notes.filter((n) => n.kind === k).length])) as Record<
    DevNoteKind,
    number
  >
  const shown = filter === "todos" ? notes : notes.filter((n) => n.kind === filter)

  return (
    <div className="flex flex-col gap-4" data-tour="dev-notes">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={filter === "todos"} onClick={() => setFilter("todos")}>
          Todos ({notes.length})
        </FilterChip>
        {DEV_NOTE_KINDS.map((kind) => (
          <FilterChip key={kind} active={filter === kind} onClick={() => setFilter(kind)} disabled={counts[kind] === 0}>
            {DEV_NOTE_LABELS[kind]} ({counts[kind]})
          </FilterChip>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8 gap-1 px-2"
          onClick={() => setReloadToken((t) => t + 1)}
        >
          <RefreshCwIcon className="size-3.5" />
          Atualizar
        </Button>
      </div>

      <ol className="flex flex-col gap-3">
        {shown.map((note) => {
          const style = KIND_STYLE[note.kind]
          const Icon = style.icon
          return (
            <li key={note.id} className="flex gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", style.className)}>
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Badge variant="secondary">{DEV_NOTE_LABELS[note.kind]}</Badge>
                  <span>{note.source}</span>
                  {note.author && <span>· conta de {note.author}</span>}
                  <span>· {dateTime.format(new Date(note.createdAt))}</span>
                </div>
                {note.task && (
                  <Link
                    href={`/dashboard/projects/${projectId}/kanban`}
                    className="truncate text-xs font-medium text-foreground hover:underline"
                  >
                    Tarefa: {note.task.title}
                  </Link>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{note.message}</p>
                {note.link && (
                  <a
                    href={note.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 self-start text-xs text-primary hover:underline"
                  >
                    {note.link.replace(/^https?:\/\//, "").slice(0, 80)}
                    <ExternalLinkIcon className="size-3" aria-hidden />
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {hasMore && (
        <Button variant="outline" size="sm" className="self-center gap-1.5" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore && <LoaderCircleIcon className="animate-spin" />}
          Carregar mais
        </Button>
      )}
    </div>
  )
}

function FilterChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"
      )}
    >
      {children}
    </button>
  )
}
