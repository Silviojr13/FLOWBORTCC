"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
  CheckIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FeatureStatusBadge } from "@/components/project/feature-status-badge"
import { FeatureStatusSelect } from "@/components/project/feature-status-select"
import { RequirementMultiSelect } from "@/components/project-manual/requirement-multi-select"
import {
  getFeatureRequirementIds,
  setFeatureRequirementIds,
  removeFeatureRequirements,
} from "@/lib/feature-requirements-store"
import { getFeatureStatusDisplay } from "@/lib/feature-status-display"
import type { FeatureStatus } from "@/lib/feature-status"
import { cn } from "@/lib/utils"

interface Feature {
  id: string
  name: string
  description: string | null
  status: FeatureStatus
  requirementId: string | null
}

interface RequirementOption {
  id: string
  code: string
  description: string
}

const NEW_ROW_ID = "__new__"

type DraftFields = {
  name: string
  description: string
  status: FeatureStatus
  requirementIds: string[]
}

const EMPTY_DRAFT: DraftFields = {
  name: "",
  description: "",
  status: "Planejada",
  requirementIds: [],
}

export function FeaturesPanel({
  projectId,
  variant = "wizard",
}: {
  projectId: string
  variant?: "wizard" | "management"
}) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [requirements, setRequirements] = useState<RequirementOption[]>([])
  const [reqMap, setReqMap] = useState<Record<string, string[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftFields>(EMPTY_DRAFT)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const [featuresRes, requirementsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/features`),
          fetch(`/api/projects/${projectId}/requirements`),
        ])
        const featuresData = await featuresRes.json()
        const requirementsData = await requirementsRes.json()
        if (!featuresRes.ok) throw new Error(featuresData.error || "Erro ao carregar funcionalidades")
        if (!cancelled) {
          const loaded: Feature[] = featuresData.features
          setFeatures(loaded)
          const map: Record<string, string[]> = {}
          for (const f of loaded) {
            map[f.id] = getFeatureRequirementIds(projectId, f.id, f.requirementId)
          }
          setReqMap(map)
          if (requirementsRes.ok) setRequirements(requirementsData.requirements)
        }
      } catch (error) {
        console.error(error)
        toast.error("Não foi possível carregar as funcionalidades.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  function startCreate() {
    setEditingId(NEW_ROW_ID)
    setDraft(EMPTY_DRAFT)
  }

  function startEdit(feature: Feature) {
    setEditingId(feature.id)
    setDraft({
      name: feature.name,
      description: feature.description ?? "",
      status: feature.status,
      requirementIds:
        reqMap[feature.id] ??
        getFeatureRequirementIds(projectId, feature.id, feature.requirementId),
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  async function confirmEdit() {
    const name = draft.name.trim()
    if (!name || isSaving) return

    const payload = {
      name,
      description: draft.description.trim() || null,
      status: draft.status,
      requirementId: draft.requirementIds[0] ?? null,
    }

    setIsSaving(true)
    try {
      if (editingId === NEW_ROW_ID) {
        const res = await fetch(`/api/projects/${projectId}/features`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao criar funcionalidade")
        setFeatureRequirementIds(projectId, data.feature.id, draft.requirementIds)
        setReqMap((prev) => ({ ...prev, [data.feature.id]: draft.requirementIds }))
        setFeatures((prev) => [...prev, data.feature])
        toast.success(`${data.feature.name} adicionada.`)
      } else if (editingId) {
        const res = await fetch(`/api/projects/${projectId}/features/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao atualizar funcionalidade")
        setFeatureRequirementIds(projectId, editingId, draft.requirementIds)
        setReqMap((prev) => ({ ...prev, [editingId]: draft.requirementIds }))
        setFeatures((prev) => prev.map((f) => (f.id === editingId ? data.feature : f)))
        toast.success(`${data.feature.name} atualizada.`)
      }
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar funcionalidade.")
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteFeature(id: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/features/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao excluir funcionalidade")
      }
      removeFeatureRequirements(projectId, id)
      setReqMap((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setFeatures((prev) => prev.filter((f) => f.id !== id))
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir funcionalidade.")
    }
  }

  function renderDraftForm() {
    return (
      <Card className="border-primary/30 lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {editingId === NEW_ROW_ID ? "Nova funcionalidade" : "Editar funcionalidade"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            autoFocus
            placeholder="Ex.: Monitoramento ambiental"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <Textarea
            placeholder="Descreva o que esta capacidade faz (opcional)"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            rows={2}
          />
          <FeatureStatusSelect
            value={draft.status}
            onValueChange={(status) => setDraft((d) => ({ ...d, status }))}
          />
          <RequirementMultiSelect
            requirements={requirements}
            selectedIds={draft.requirementIds}
            onChange={(ids) => setDraft((d) => ({ ...d, requirementIds: ids }))}
          />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button size="sm" variant="ghost" disabled={isSaving} onClick={cancelEdit}>
            <XIcon className="size-4" />
            Cancelar
          </Button>
          <Button size="sm" disabled={isSaving} onClick={confirmEdit}>
            <CheckIcon className="size-4" />
            Salvar
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const emptyMessage =
    variant === "wizard"
      ? "Transforme seus requisitos nas capacidades principais do projeto."
      : "Adicione funcionalidades para organizar o desenvolvimento e o Kanban."

  return (
    <div className="flex flex-col gap-4">
      {variant === "wizard" && (
        <p className="text-sm text-muted-foreground">
          Cada funcionalidade terá um status (Planejada, Em desenvolvimento ou Concluída) que
          aparecerá no Kanban do projeto.
        </p>
      )}

      {isLoading && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Carregando funcionalidades...
        </p>
      )}

      {!isLoading && features.length === 0 && editingId !== NEW_ROW_ID && (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">Nenhuma funcionalidade definida.</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {features.map((feature) => {
          if (editingId === feature.id) {
            return (
              <div key={feature.id} className="lg:col-span-2">
                {renderDraftForm()}
              </div>
            )
          }

          const display = getFeatureStatusDisplay(feature.status)
          const linkedIds =
            reqMap[feature.id] ??
            getFeatureRequirementIds(projectId, feature.id, feature.requirementId)
          const linkedReqs = requirements.filter((r) => linkedIds.includes(r.id))

          return (
            <Card key={feature.id} className={cn("flex flex-col bg-card/95", display.cardClass)}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <CardTitle className="text-base leading-snug">{feature.name}</CardTitle>
                <FeatureStatusBadge status={feature.status} />
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                {feature.description && (
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                )}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Requisitos relacionados
                  </span>
                  {linkedReqs.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {linkedReqs.map((req) => (
                        <li key={req.id} className="text-sm leading-relaxed">
                          {req.description}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {req.code}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum requisito vinculado</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-1 pt-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(feature)}>
                  <PencilIcon className="size-4" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteFeature(feature.id)}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2Icon className="size-4" />
                  Excluir
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {editingId === NEW_ROW_ID && renderDraftForm()}

      {editingId !== NEW_ROW_ID && (
        <Button variant="outline" size="sm" className="w-fit gap-1.5" onClick={startCreate}>
          <PlusIcon className="size-4" />
          Adicionar funcionalidade
        </Button>
      )}
    </div>
  )
}
