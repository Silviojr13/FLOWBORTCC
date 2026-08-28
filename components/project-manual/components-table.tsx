"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PencilIcon, PlusIcon, Trash2Icon, XIcon, CheckIcon } from "lucide-react"

interface HardwareComponentItem {
  id: string
  name: string
  description: string | null
  quantity: number
  unitPrice: number
  requirementId: string | null
}

interface RequirementOption {
  id: string
  code: string
  description: string
}

const NEW_ROW_ID = "__new__"
const NO_REQUIREMENT = "__none__"

type DraftFields = {
  name: string
  quantity: string
  unitPrice: string
  requirementId: string
}

const EMPTY_DRAFT: DraftFields = {
  name: "",
  quantity: "1",
  unitPrice: "0",
  requirementId: NO_REQUIREMENT,
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function ComponentsTable({ projectId }: { projectId: string }) {
  const [components, setComponents] = useState<HardwareComponentItem[]>([])
  const [requirements, setRequirements] = useState<RequirementOption[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftFields>(EMPTY_DRAFT)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const [componentsRes, requirementsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/components`),
          fetch(`/api/projects/${projectId}/requirements`),
        ])
        const componentsData = await componentsRes.json()
        const requirementsData = await requirementsRes.json()
        if (!componentsRes.ok) throw new Error(componentsData.error || "Erro ao carregar componentes")
        if (!cancelled) {
          setComponents(componentsData.components)
          setTotalCost(componentsData.totalCost)
          if (requirementsRes.ok) setRequirements(requirementsData.requirements)
        }
      } catch (error) {
        console.error(error)
        toast.error("Não foi possível carregar os componentes.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  function recomputeTotal(list: HardwareComponentItem[]) {
    setTotalCost(list.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0))
  }

  function requirementLabel(id: string | null) {
    if (!id) return "—"
    const requirement = requirements.find((r) => r.id === id)
    return requirement ? requirement.code : "—"
  }

  function startCreate() {
    setEditingId(NEW_ROW_ID)
    setDraft(EMPTY_DRAFT)
  }

  function startEdit(component: HardwareComponentItem) {
    setEditingId(component.id)
    setDraft({
      name: component.name,
      quantity: String(component.quantity),
      unitPrice: String(component.unitPrice),
      requirementId: component.requirementId ?? NO_REQUIREMENT,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  async function confirmEdit() {
    const name = draft.name.trim()
    const quantity = Number(draft.quantity)
    const unitPrice = Number(draft.unitPrice)

    if (!name || isSaving) return
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error("Quantidade inválida.")
      return
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error("Preço unitário inválido.")
      return
    }

    const payload = {
      name,
      quantity,
      unitPrice,
      requirementId: draft.requirementId === NO_REQUIREMENT ? null : draft.requirementId,
    }

    setIsSaving(true)
    try {
      if (editingId === NEW_ROW_ID) {
        const res = await fetch(`/api/projects/${projectId}/components`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao criar componente")
        const updated = [...components, data.component]
        setComponents(updated)
        recomputeTotal(updated)
        toast.success(`${data.component.name} adicionado.`)
      } else if (editingId) {
        const res = await fetch(`/api/projects/${projectId}/components/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao atualizar componente")
        const updated = components.map((c) => (c.id === editingId ? data.component : c))
        setComponents(updated)
        recomputeTotal(updated)
        toast.success(`${data.component.name} atualizado.`)
      }
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar componente.")
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteComponent(id: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/components/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao excluir componente")
      }
      const updated = components.filter((c) => c.id !== id)
      setComponents(updated)
      recomputeTotal(updated)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir componente.")
    }
  }

  const draftRowFields = (
    <>
      <TableCell>
        <Input
          autoFocus
          placeholder="Nome do componente"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmEdit()
            if (e.key === "Escape") cancelEdit()
          }}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          step={1}
          value={draft.quantity}
          onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={draft.unitPrice}
          onChange={(e) => setDraft((d) => ({ ...d, unitPrice: e.target.value }))}
        />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {currency.format((Number(draft.quantity) || 0) * (Number(draft.unitPrice) || 0))}
      </TableCell>
      <TableCell>
        <Select
          value={draft.requirementId}
          onValueChange={(v) => setDraft((d) => ({ ...d, requirementId: v }))}
        >
          <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_REQUIREMENT}>Nenhum</SelectItem>
            {requirements.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.code}</SelectItem>
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
    </>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Componente</TableHead>
              <TableHead className="w-20">Qtd.</TableHead>
              <TableHead className="w-28">Preço unit.</TableHead>
              <TableHead className="w-28">Subtotal</TableHead>
              <TableHead className="w-28">Requisito</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  Carregando componentes...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && components.length === 0 && editingId !== NEW_ROW_ID && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum componente cadastrado ainda.
                </TableCell>
              </TableRow>
            )}

            {components.map((component) =>
              editingId === component.id ? (
                <TableRow key={component.id}>{draftRowFields}</TableRow>
              ) : (
                <TableRow key={component.id}>
                  <TableCell>{component.name}</TableCell>
                  <TableCell>{component.quantity}</TableCell>
                  <TableCell>{currency.format(component.unitPrice)}</TableCell>
                  <TableCell className="font-medium">
                    {currency.format(component.quantity * component.unitPrice)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {requirementLabel(component.requirementId)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(component)}
                        aria-label="Editar componente"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteComponent(component.id)}
                        aria-label="Excluir componente"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}

            {editingId === NEW_ROW_ID && <TableRow>{draftRowFields}</TableRow>}
          </TableBody>
          {components.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Custo total estimado
                </TableCell>
                <TableCell colSpan={3} className="font-semibold">
                  {currency.format(totalCost)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {editingId !== NEW_ROW_ID && (
        <Button variant="outline" size="sm" className="w-fit gap-1.5" onClick={startCreate}>
          <PlusIcon className="size-4" />
          Adicionar componente
        </Button>
      )}
    </div>
  )
}
