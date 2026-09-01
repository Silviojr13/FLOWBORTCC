"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { setComponentOrigin } from "@/lib/component-origin-store"

const NO_REQUIREMENT = "__none__"

interface RequirementOption {
  id: string
  code: string
  description: string
}

export interface ComponentFormValues {
  name: string
  description: string
  quantity: string
  unitPrice: string
  requirementId: string
}

const EMPTY: ComponentFormValues = {
  name: "",
  description: "",
  quantity: "1",
  unitPrice: "",
  requirementId: NO_REQUIREMENT,
}

export function ComponentAddDialog({
  open,
  onOpenChange,
  projectId,
  requirements,
  initialValues,
  editingId,
  referencePriceRange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  requirements: RequirementOption[]
  initialValues?: Partial<ComponentFormValues>
  editingId?: string | null
  referencePriceRange?: { min: number; max: number }
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<ComponentFormValues>(() => ({ ...EMPTY, ...initialValues }))
  const [isSaving, setIsSaving] = useState(false)

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft({ ...EMPTY, ...initialValues })
    }
    onOpenChange(next)
  }

  async function handleSubmit() {
    const name = draft.name.trim()
    const quantity = Number(draft.quantity)
    const unitPrice = Number(draft.unitPrice)

    if (!name) {
      toast.error("Nome do componente é obrigatório.")
      return
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error("Quantidade inválida.")
      return
    }
    if (draft.unitPrice.trim() === "" || !Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error("Informe um preço unitário válido.")
      return
    }

    const payload = {
      name,
      description: draft.description.trim() || undefined,
      quantity,
      unitPrice,
      requirementId: draft.requirementId === NO_REQUIREMENT ? null : draft.requirementId,
    }

    setIsSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/projects/${projectId}/components/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao atualizar componente")
        toast.success(`${data.component.name} atualizado.`)
      } else {
        const res = await fetch(`/api/projects/${projectId}/components`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao criar componente")
        setComponentOrigin(projectId, data.component.id, "manual")
        toast.success(`${data.component.name} adicionado.`)
      }
      onSaved()
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar componente.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Editar componente" : "Adicionar componente"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="comp-name">Nome *</FieldLabel>
            <Input
              id="comp-name"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Ex.: Sensor DHT22"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="comp-desc">Descrição</FieldLabel>
            <Textarea
              id="comp-desc"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={2}
              placeholder="Breve descrição, se necessário"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="comp-qty">Quantidade *</FieldLabel>
              <Input
                id="comp-qty"
                type="number"
                min={1}
                step={1}
                value={draft.quantity}
                onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="comp-price">Preço unitário (R$) *</FieldLabel>
              <Input
                id="comp-price"
                type="number"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={draft.unitPrice}
                onChange={(e) => setDraft((d) => ({ ...d, unitPrice: e.target.value }))}
              />
              {referencePriceRange && (
                <p className="text-xs text-muted-foreground">
                  Preço de referência:{" "}
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(referencePriceRange.min)}{" "}
                  –{" "}
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(referencePriceRange.max)}
                </p>
              )}
            </Field>
          </div>
          <Field>
            <FieldLabel>Requisito relacionado</FieldLabel>
            <Select
              value={draft.requirementId}
              onValueChange={(v) => setDraft((d) => ({ ...d, requirementId: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_REQUIREMENT}>Nenhum</SelectItem>
                {requirements.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.code} — {r.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Salvando..." : editingId ? "Salvar" : "Adicionar componente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
