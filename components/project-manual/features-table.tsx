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

interface Feature {
  id: string
  name: string
  description: string | null
  status: "Planejada" | "Em desenvolvimento" | "Concluída"
  requirementId: string | null
}

interface RequirementOption {
  id: string
  code: string
}

const STATUSES: Feature["status"][] = ["Planejada", "Em desenvolvimento", "Concluída"]
const NEW_ROW_ID = "__new__"
const NO_REQUIREMENT = "__none__"

type DraftFields = {
  name: string
  status: Feature["status"]
  requirementId: string
}

const EMPTY_DRAFT: DraftFields = {
  name: "",
  status: "Planejada",
  requirementId: NO_REQUIREMENT,
}

function statusVariant(status: Feature["status"]) {
  if (status === "Concluída") return "default"
  if (status === "Em desenvolvimento") return "secondary"
  return "outline"
}

export function FeaturesTable({ projectId }: { projectId: string }) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [requirements, setRequirements] = useState<RequirementOption[]>([])
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
          setFeatures(featuresData.features)
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

  function requirementLabel(id: string | null) {
    if (!id) return "—"
    const requirement = requirements.find((r) => r.id === id)
    return requirement ? requirement.code : "—"
  }

  function startCreate() {
    setEditingId(NEW_ROW_ID)
    setDraft(EMPTY_DRAFT)
  }

  function startEdit(feature: Feature) {
    setEditingId(feature.id)
    setDraft({
      name: feature.name,
      status: feature.status,
      requirementId: feature.requirementId ?? NO_REQUIREMENT,
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
      status: draft.status,
      requirementId: draft.requirementId === NO_REQUIREMENT ? null : draft.requirementId,
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
      setFeatures((prev) => prev.filter((f) => f.id !== id))
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir funcionalidade.")
    }
  }

  const draftRowFields = (
    <>
      <TableCell>
        <Input
          autoFocus
          placeholder="Ex.: Detecção de linha em curvas"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmEdit()
            if (e.key === "Escape") cancelEdit()
          }}
        />
      </TableCell>
      <TableCell>
        <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v as Feature["status"] }))}>
          <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={draft.requirementId} onValueChange={(v) => setDraft((d) => ({ ...d, requirementId: v }))}>
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
              <TableHead>Funcionalidade</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead className="w-28">Requisito</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  Carregando funcionalidades...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && features.length === 0 && editingId !== NEW_ROW_ID && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma funcionalidade cadastrada ainda. Transforme um requisito em algo concreto que o robô vai fazer.
                </TableCell>
              </TableRow>
            )}

            {features.map((feature) =>
              editingId === feature.id ? (
                <TableRow key={feature.id}>{draftRowFields}</TableRow>
              ) : (
                <TableRow key={feature.id}>
                  <TableCell>{feature.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(feature.status)}>{feature.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {requirementLabel(feature.requirementId)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(feature)} aria-label="Editar funcionalidade">
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteFeature(feature.id)} aria-label="Excluir funcionalidade">
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}

            {editingId === NEW_ROW_ID && <TableRow>{draftRowFields}</TableRow>}
          </TableBody>
        </Table>
      </div>

      {editingId !== NEW_ROW_ID && (
        <Button variant="outline" size="sm" className="w-fit gap-1.5" onClick={startCreate}>
          <PlusIcon className="size-4" />
          Adicionar funcionalidade
        </Button>
      )}
    </div>
  )
}
