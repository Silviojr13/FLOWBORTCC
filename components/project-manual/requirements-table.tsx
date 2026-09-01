"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PencilIcon, PlusIcon, Trash2Icon, XIcon, CheckIcon } from "lucide-react"
import {
  CategoryIndicator,
  PriorityIndicator,
  PrioritySelectItem,
  StatusIndicator,
  StatusSelectItem,
} from "@/components/project-manual/requirement-indicators"

export interface Requirement {
  id: string
  code: string
  description: string
  category: "Funcional" | "Não Funcional"
  priority: "Alta" | "Média" | "Baixa"
  status: "Em Aberto" | "Validado" | "Descartado"
}

const CATEGORIES: Requirement["category"][] = ["Funcional", "Não Funcional"]
const PRIORITIES: Requirement["priority"][] = ["Alta", "Média", "Baixa"]
const STATUSES: Requirement["status"][] = ["Em Aberto", "Validado", "Descartado"]

const NEW_ROW_ID = "__new__"

type DraftFields = {
  description: string
  category: Requirement["category"]
  priority: Requirement["priority"]
  status: Requirement["status"]
}

const EMPTY_DRAFT: DraftFields = {
  description: "",
  category: "Funcional",
  priority: "Média",
  status: "Em Aberto",
}


export function RequirementsTable({
  projectId,
  initialRequirements,
  onCountChange,
}: {
  projectId: string
  initialRequirements?: { description: string; category: Requirement["category"] }[]
  onCountChange?: (count: number) => void
}) {
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftFields>(EMPTY_DRAFT)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/projects/${projectId}/requirements`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao carregar requisitos")
        if (!cancelled) {
          setRequirements(data.requirements)
          onCountChange?.(data.requirements.length)
        }
      } catch (error) {
        console.error(error)
        toast.error("Não foi possível carregar os requisitos.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  // Se a página chegou com requisitos pré-preenchidos (ex.: gerados pelo chat), cria-os automaticamente.
  useEffect(() => {
    if (!initialRequirements || initialRequirements.length === 0 || isLoading) return

    let cancelled = false

    async function importFromChat() {
      for (const item of initialRequirements!) {
        try {
          const res = await fetch(`/api/projects/${projectId}/requirements`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: item.description,
              category: item.category,
              priority: "Média",
              status: "Em Aberto",
            }),
          })
          const data = await res.json()
          if (res.ok && !cancelled) {
            setRequirements((prev) => [...prev, data.requirement])
          }
        } catch (error) {
          console.error(error)
        }
      }
      if (!cancelled) {
        toast.success(`${initialRequirements!.length} requisito(s) importado(s) da conversa.`)
      }
    }

    importFromChat()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  function startCreate() {
    setEditingId(NEW_ROW_ID)
    setDraft(EMPTY_DRAFT)
  }

  function startEdit(requirement: Requirement) {
    setEditingId(requirement.id)
    setDraft({
      description: requirement.description,
      category: requirement.category,
      priority: requirement.priority,
      status: requirement.status,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  async function confirmEdit() {
    const description = draft.description.trim()
    if (!description || isSaving) return

    setIsSaving(true)
    try {
      if (editingId === NEW_ROW_ID) {
        const res = await fetch(`/api/projects/${projectId}/requirements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, description }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao criar requisito")
        setRequirements((prev) => {
          const next = [...prev, data.requirement]
          onCountChange?.(next.length)
          return next
        })
        toast.success(`${data.requirement.code} criado.`)
      } else if (editingId) {
        const res = await fetch(`/api/projects/${projectId}/requirements/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, description }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao atualizar requisito")
        setRequirements((prev) =>
          prev.map((r) => (r.id === editingId ? data.requirement : r))
        )
        toast.success(`${data.requirement.code} atualizado.`)
      }
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar requisito.")
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteRequirement(id: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao excluir requisito")
      }
      setRequirements((prev) => {
        const next = prev.filter((r) => r.id !== id)
        onCountChange?.(next.length)
        return next
      })
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir requisito.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-border bg-card/95 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24 bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Código
              </TableHead>
              <TableHead className="bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Descrição
              </TableHead>
              <TableHead className="w-40 bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Categoria
              </TableHead>
              <TableHead className="w-28 bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prioridade
              </TableHead>
              <TableHead className="w-32 bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="w-20 bg-muted/40 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  Carregando requisitos...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && requirements.length === 0 && editingId !== NEW_ROW_ID && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <p className="text-sm font-medium text-foreground">Nenhum requisito adicionado ainda.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Comece descrevendo o que seu projeto precisa atender.
                  </p>
                </TableCell>
              </TableRow>
            )}

            {requirements.map((requirement) =>
              editingId === requirement.id ? (
                <TableRow key={requirement.id}>
                  <TableCell className="font-mono text-xs">
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {requirement.code}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      autoFocus
                      value={draft.description}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmEdit()
                        if (e.key === "Escape") cancelEdit()
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={draft.category}
                      onValueChange={(v) => setDraft((d) => ({ ...d, category: v as Requirement["category"] }))}
                    >
                      <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={draft.priority}
                      onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as Requirement["priority"] }))}
                    >
                      <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            <PrioritySelectItem value={p} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={draft.status}
                      onValueChange={(v) => setDraft((d) => ({ ...d, status: v as Requirement["status"] }))}
                    >
                      <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            <StatusSelectItem value={s} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" disabled={isSaving} onClick={confirmEdit} aria-label="Salvar">
                        <CheckIcon className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={isSaving} onClick={cancelEdit} aria-label="Cancelar">
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={requirement.id}>
                  <TableCell className="font-mono text-xs">
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {requirement.code}
                    </Badge>
                  </TableCell>
                  <TableCell>{requirement.description}</TableCell>
                  <TableCell><CategoryIndicator value={requirement.category} /></TableCell>
                  <TableCell><PriorityIndicator value={requirement.priority} /></TableCell>
                  <TableCell><StatusIndicator value={requirement.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(requirement)}
                        aria-label="Editar requisito"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteRequirement(requirement.id)}
                        aria-label="Excluir requisito"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}

            {editingId === NEW_ROW_ID && (
              <TableRow>
                <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                <TableCell>
                  <Input
                    autoFocus
                    placeholder="Descreva o requisito"
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEdit()
                      if (e.key === "Escape") cancelEdit()
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={draft.category}
                    onValueChange={(v) => setDraft((d) => ({ ...d, category: v as Requirement["category"] }))}
                  >
                    <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={draft.priority}
                    onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as Requirement["priority"] }))}
                  >
                    <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          <PrioritySelectItem value={p} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setDraft((d) => ({ ...d, status: v as Requirement["status"] }))}
                  >
                    <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <StatusSelectItem value={s} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" disabled={isSaving} onClick={confirmEdit} aria-label="Salvar">
                      <CheckIcon className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={isSaving} onClick={cancelEdit} aria-label="Cancelar">
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editingId !== NEW_ROW_ID && (
        <Button size="sm" className="w-fit gap-1.5" onClick={startCreate}>
          <PlusIcon className="size-4" />
          Adicionar requisito
        </Button>
      )}
    </div>
  )
}
