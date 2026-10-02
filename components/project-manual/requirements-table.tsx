"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { showProjectEffects } from "@/lib/project-effects"
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
import { HELP, HelpLabel } from "@/components/help-tooltip"
import {
  CategoryIndicator,
  PriorityIndicator,
  PrioritySelectItem,
  StatusIndicator,
  StatusSelectItem,
  CoverageIndicator,
} from "@/components/project-manual/requirement-indicators"

export interface Requirement {
  id: string
  code: string
  description: string
  category: "Funcional" | "Não Funcional"
  priority: "Alta" | "Média" | "Baixa"
  status: "Em Aberto" | "Validado" | "Descartado"
  // Repercussão dos demais módulos, devolvida pela API (integração entre módulos).
  tasksTotal?: number
  tasksDone?: number
  featuresTotal?: number
  componentsTotal?: number
  estimatedCost?: number
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

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

    void load()
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

    void importFromChat()
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
          prev.map((r) =>
            // A resposta do PATCH não recalcula cobertura/custo: preserva o que já temos.
            r.id === editingId ? { ...r, ...data.requirement } : r
          )
        )
        toast.success(`${data.requirement.code} atualizado.`)
        showProjectEffects(data.effects)
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
    const requirement = requirements.find((r) => r.id === id)

    // Excluir desvincula tarefas, funcionalidades e componentes em cascata (SetNull).
    // Avisa o que será afetado antes, em vez de fazer isso em silêncio.
    const impact = [
      requirement?.tasksTotal ? `${requirement.tasksTotal} tarefa(s)` : null,
      requirement?.featuresTotal ? `${requirement.featuresTotal} funcionalidade(s)` : null,
      requirement?.componentsTotal ? `${requirement.componentsTotal} componente(s)` : null,
    ].filter(Boolean)

    const confirmation = impact.length
      ? `Excluir ${requirement?.code}? ${impact.join(", ")} ficarão sem requisito vinculado.`
      : `Excluir ${requirement?.code ?? "este requisito"}?`

    if (!window.confirm(confirmation)) return

    try {
      const res = await fetch(`/api/projects/${projectId}/requirements/${id}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir requisito")
      }
      setRequirements((prev) => {
        const next = prev.filter((r) => r.id !== id)
        onCountChange?.(next.length)
        return next
      })
      showProjectEffects(data.effects)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir requisito.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div data-tour="requirements-coverage" className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24 bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Código
              </TableHead>
              <TableHead className="bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Descrição
              </TableHead>
              <TableHead className="w-44 bg-muted text-xs font-medium tracking-wide text-muted-foreground">
                <HelpLabel label="Categoria" content={HELP.category}>
                  <span className="uppercase">Categoria</span>
                </HelpLabel>
              </TableHead>
              <TableHead className="w-32 bg-muted text-xs font-medium tracking-wide text-muted-foreground">
                <HelpLabel label="Prioridade" content={HELP.priority}>
                  <span className="uppercase">Prioridade</span>
                </HelpLabel>
              </TableHead>
              <TableHead className="w-32 bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="w-32 bg-muted text-xs font-medium tracking-wide text-muted-foreground">
                <HelpLabel label="Cobertura" content={HELP.coverage}>
                  <span className="uppercase">Cobertura</span>
                </HelpLabel>
              </TableHead>
              <TableHead className="w-28 bg-muted text-xs font-medium tracking-wide text-muted-foreground">
                <span className="flex justify-end">
                  <HelpLabel label="Custo" content={HELP.requirementCost}>
                    <span className="uppercase">Custo</span>
                  </HelpLabel>
                </span>
              </TableHead>
              <TableHead className="w-20 bg-muted text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                  Carregando requisitos...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && requirements.length === 0 && editingId !== NEW_ROW_ID && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center">
                  <p className="text-sm font-medium text-foreground">Nenhum requisito ainda.</p>
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
                        if (e.key === "Enter") void confirmEdit()
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
                  <TableCell colSpan={3} className="text-right">
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
                  <TableCell>
                    <CoverageIndicator
                      total={requirement.tasksTotal ?? 0}
                      done={requirement.tasksDone ?? 0}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {requirement.componentsTotal ? (
                      <span title={`${requirement.componentsTotal} componente(s) vinculado(s)`}>
                        {currency.format(requirement.estimatedCost ?? 0)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
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
                      if (e.key === "Enter") void confirmEdit()
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
