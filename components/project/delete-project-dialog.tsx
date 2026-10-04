"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { notifyProjectsChanged } from "@/lib/projects-changed"

interface Preview {
  name: string
  isTutorial: boolean
  counts: Record<
    "requirements" | "features" | "tasks" | "sprints" | "components" | "resources" | "diagrams" | "chats",
    number
  >
}

const ITEMS: [keyof Preview["counts"], string, string][] = [
  ["requirements", "requisito", "requisitos"],
  ["features", "funcionalidade", "funcionalidades"],
  ["tasks", "tarefa", "tarefas"],
  ["sprints", "sprint", "sprints"],
  ["components", "componente", "componentes"],
  ["resources", "recurso", "recursos"],
  ["diagrams", "diagrama", "diagramas"],
]

const normalize = (text: string) => text.trim().toLocaleLowerCase("pt-BR")

/**
 * Confirmação de exclusão de projeto: mostra tudo o que será apagado e pede que a pessoa
 * digite o nome do projeto, para a ação irreversível não acontecer por um clique errado.
 */
export function DeleteProjectDialog({
  projectId,
  open,
  onOpenChange,
  onDeleted,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sem callback, a tela volta para a lista de projetos. */
  onDeleted?: () => void
}) {
  const router = useRouter()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch(`/api/projects/${projectId}/delete-preview`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.counts) setPreview(data)
      })
      .catch(() => !cancelled && toast.error("Não foi possível carregar os dados do projeto."))
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  function close(next: boolean) {
    if (busy) return
    if (!next) setTyped("")
    onOpenChange(next)
  }

  async function remove() {
    if (!preview) return
    setBusy(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Não foi possível excluir o projeto.")
      }
      toast.success(`Projeto “${preview.name}” excluído.`)
      notifyProjectsChanged()
      setTyped("")
      onOpenChange(false)
      if (onDeleted) onDeleted()
      else {
        router.push("/dashboard/projects")
        router.refresh()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o projeto.")
    } finally {
      setBusy(false)
    }
  }

  const listed = preview ? ITEMS.filter(([key]) => preview.counts[key] > 0) : []
  const matches = preview ? normalize(typed) === normalize(preview.name) : false

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="size-5 text-destructive" aria-hidden />
            Excluir projeto
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. O projeto e tudo o que está dentro dele serão apagados
            para sempre.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="font-medium text-foreground">{preview.name}</p>
              {listed.length > 0 ? (
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                  {listed.map(([key, singular, plural]) => (
                    <li key={key} className="tabular-nums">
                      {preview.counts[key]} {preview.counts[key] === 1 ? singular : plural}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted-foreground">O projeto está vazio.</p>
              )}
            </div>

            {preview.counts.chats > 0 && (
              <p className="text-xs text-muted-foreground">
                As conversas com a IA ligadas a este projeto não são apagadas: continuam no seu
                histórico de conversas.
              </p>
            )}
            {preview.isTutorial && (
              <p className="text-xs text-muted-foreground">
                Este é o projeto de exemplo do tour. Se fizer o tour de novo, um novo exemplo é criado.
              </p>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-foreground">
                Para confirmar, digite o nome do projeto: <strong className="font-semibold">{preview.name}</strong>
              </span>
              <Input
                id="delete-project-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                aria-label="Nome do projeto para confirmar a exclusão"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches && !busy) void remove()
                }}
              />
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void remove()} disabled={!matches || busy}>
            {busy && <LoaderCircleIcon className="animate-spin" />}
            Excluir projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
