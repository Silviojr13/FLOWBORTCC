"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  DEFAULT_COST_MODEL,
  RESOURCE_AVAILABILITY,
  RESOURCE_AVAILABILITY_LABELS,
  RESOURCE_COST_MODELS,
  RESOURCE_COST_MODEL_LABELS,
  RESOURCE_QUANTITY_LABELS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_HINTS,
  RESOURCE_TYPE_LABELS,
  resourceCost,
  type Resource,
  type ResourceAvailability,
  type ResourceCostModel,
  type ResourceType,
} from "@/lib/resources"

const NO_REQUIREMENT = "__none__"
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

interface Draft {
  name: string
  description: string
  type: ResourceType
  availability: ResourceAvailability
  costModel: ResourceCostModel
  unitCost: string
  quantity: string
  requirementId: string
}

function toDraft(resource: Resource | null, type: ResourceType): Draft {
  if (!resource) {
    return {
      name: "",
      description: "",
      type,
      availability: "disponivel",
      costModel: DEFAULT_COST_MODEL[type],
      unitCost: "",
      quantity: "1",
      requirementId: NO_REQUIREMENT,
    }
  }
  return {
    name: resource.name,
    description: resource.description ?? "",
    type: resource.type,
    availability: resource.availability,
    costModel: resource.costModel,
    unitCost: String(resource.unitCost),
    quantity: String(resource.quantity),
    requirementId: resource.requirementId ?? NO_REQUIREMENT,
  }
}

export function ResourceDialog({
  open,
  onOpenChange,
  projectId,
  resource,
  defaultType,
  requirements,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** null = novo recurso */
  resource: Resource | null
  defaultType: ResourceType
  requirements: { id: string; code: string; description: string }[]
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(resource, defaultType))
  const [isSaving, setIsSaving] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)

  // Reinicia o formulário sempre que o diálogo abre para outro recurso (ou para um novo).
  const key = open ? `${resource?.id ?? "novo"}-${defaultType}` : null
  if (key !== lastKey) {
    setLastKey(key)
    if (key) setDraft(toDraft(resource, defaultType))
  }

  const unitCost = Number(draft.unitCost.replace(",", "."))
  const quantity = Number(draft.quantity.replace(",", "."))
  const preview =
    Number.isFinite(unitCost) && Number.isFinite(quantity) ? resourceCost({ unitCost, quantity }) : null

  function changeType(type: ResourceType) {
    // Ao trocar o tipo de um recurso novo, sugere a forma de cobrança mais comum para ele.
    setDraft((d) => ({ ...d, type, costModel: resource ? d.costModel : DEFAULT_COST_MODEL[type] }))
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Informe o nome do recurso.")
      return
    }
    if (draft.unitCost.trim() === "" || !Number.isFinite(unitCost) || unitCost < 0) {
      toast.error("Informe um custo válido.")
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("A quantidade deve ser maior que zero.")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(
        resource ? `/api/projects/${projectId}/resources/${resource.id}` : `/api/projects/${projectId}/resources`,
        {
          method: resource ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            description: draft.description,
            type: draft.type,
            availability: draft.availability,
            costModel: draft.costModel,
            unitCost,
            quantity,
            requirementId: draft.requirementId === NO_REQUIREMENT ? null : draft.requirementId,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar o recurso.")
      toast.success(resource ? "Recurso atualizado." : `${data.resource.name} adicionado.`)
      onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o recurso.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{resource ? "Editar recurso" : "Adicionar recurso"}</DialogTitle>
          <DialogDescription>
            Pessoas, equipamentos, software e espaços usados para construir o projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <Select value={draft.type} onValueChange={(v) => changeType(v as ResourceType)}>
                <SelectTrigger aria-label="Tipo do recurso">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {RESOURCE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Disponibilidade</FieldLabel>
              <Select
                value={draft.availability}
                onValueChange={(v) => setDraft((d) => ({ ...d, availability: v as ResourceAvailability }))}
              >
                <SelectTrigger aria-label="Disponibilidade do recurso">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_AVAILABILITY.map((a) => (
                    <SelectItem key={a} value={a}>
                      {RESOURCE_AVAILABILITY_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="resource-name">Nome *</FieldLabel>
            <Input
              id="resource-name"
              autoFocus
              value={draft.name}
              maxLength={120}
              placeholder={RESOURCE_TYPE_HINTS[draft.type]}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="resource-description">Descrição</FieldLabel>
            <Textarea
              id="resource-description"
              rows={2}
              maxLength={500}
              value={draft.description}
              placeholder="Papel no projeto, especificação ou observações"
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel>Cobrança</FieldLabel>
              <Select
                value={draft.costModel}
                onValueChange={(v) => setDraft((d) => ({ ...d, costModel: v as ResourceCostModel }))}
              >
                <SelectTrigger aria-label="Forma de cobrança">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_COST_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {RESOURCE_COST_MODEL_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="resource-cost">
                {draft.costModel === "hora" ? "Custo/hora (R$)" : draft.costModel === "mes" ? "Custo/mês (R$)" : "Custo (R$)"}
              </FieldLabel>
              <Input
                id="resource-cost"
                type="number"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={draft.unitCost}
                onChange={(e) => setDraft((d) => ({ ...d, unitCost: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resource-quantity">{RESOURCE_QUANTITY_LABELS[draft.costModel]}</FieldLabel>
              <Input
                id="resource-quantity"
                type="number"
                min={0}
                step={draft.costModel === "unico" ? 1 : 0.5}
                value={draft.quantity}
                onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Requisito relacionado</FieldLabel>
            <Select
              value={draft.requirementId}
              onValueChange={(v) => setDraft((d) => ({ ...d, requirementId: v }))}
            >
              <SelectTrigger aria-label="Requisito relacionado">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
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

          {preview !== null && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              Custo total do recurso: <span className="font-semibold">{currency.format(preview)}</span>
              {draft.availability === "disponivel" && (
                <span className="block text-xs text-muted-foreground">
                  Já disponível: entra no orçamento como custo de uso, não como compra.
                </span>
              )}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={isSaving}>
            {isSaving ? "Salvando..." : resource ? "Salvar" : "Adicionar recurso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
