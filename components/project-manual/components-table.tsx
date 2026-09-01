"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  BotIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ComponentAddDialog } from "@/components/project-manual/component-add-dialog"
import { ComponentSearchSheet } from "@/components/project-manual/component-search-sheet"
import {
  loadComponentOrigins,
  removeComponentOrigin,
  type ComponentOrigin,
} from "@/lib/component-origin-store"

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

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function ComponentsTable({
  projectId,
  onChange,
}: {
  projectId: string
  onChange?: () => void
}) {
  const [components, setComponents] = useState<HardwareComponentItem[]>([])
  const [requirements, setRequirements] = useState<RequirementOption[]>([])
  const [origins, setOrigins] = useState<Record<string, ComponentOrigin>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [editingComponent, setEditingComponent] = useState<HardwareComponentItem | null>(null)

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
          setOrigins(loadComponentOrigins(projectId))
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

  async function reloadComponents() {
    try {
      const [componentsRes, requirementsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/components`),
        fetch(`/api/projects/${projectId}/requirements`),
      ])
      const componentsData = await componentsRes.json()
      const requirementsData = await requirementsRes.json()
      if (!componentsRes.ok) throw new Error(componentsData.error || "Erro ao carregar componentes")
      setComponents(componentsData.components)
      setOrigins(loadComponentOrigins(projectId))
      if (requirementsRes.ok) setRequirements(requirementsData.requirements)
      onChange?.()
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível recarregar os componentes.")
    }
  }

  function requirementInfo(id: string | null) {
    if (!id) return null
    return requirements.find((r) => r.id === id) ?? null
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
      removeComponentOrigin(projectId, id)
      setComponents((prev) => prev.filter((c) => c.id !== id))
      onChange?.()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir componente.")
    }
  }

  const existingNames = components.map((c) => c.name)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button className="gap-1.5 sm:flex-1" onClick={() => setSearchOpen(true)}>
          <SearchIcon className="size-4" />
          Buscar componentes
        </Button>
        <Button
          variant="outline"
          className="gap-1.5 sm:w-auto"
          onClick={() => {
            setEditingComponent(null)
            setAddOpen(true)
          }}
        >
          <PlusIcon className="size-4" />
          Adicionar manualmente
        </Button>
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-foreground">Componentes adicionados ao projeto</h3>
        <p className="text-xs text-muted-foreground">
          Itens confirmados para este projeto — distintos das sugestões da IA acima.
        </p>
      </div>

      {isLoading && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Carregando componentes...
        </p>
      )}

      {!isLoading && components.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">
            Nenhum componente adicionado ao projeto.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Busque componentes ou escolha uma sugestão da IA.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {components.map((component) => {
          const req = requirementInfo(component.requirementId)
          const subtotal = component.quantity * component.unitPrice
          const origin = origins[component.id]

          return (
            <Card key={component.id} className="flex flex-col bg-card/95">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                    <BotIcon className="size-4 text-primary/70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base leading-snug">{component.name}</CardTitle>
                      {origin === "ia" && (
                        <Badge variant="outline" className="gap-0.5 border-primary/30 text-primary">
                          <SparklesIcon className="size-3" />
                          IA
                        </Badge>
                      )}
                    </div>
                    {component.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{component.description}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Quantidade</span>
                    <p className="font-medium">{component.quantity}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Preço unit.</span>
                    <p className="font-medium">{currency.format(component.unitPrice)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">Subtotal</span>
                    <p className="font-semibold">{currency.format(subtotal)}</p>
                  </div>
                </div>
                {req && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Requisito relacionado
                    </span>
                    <p className="text-sm leading-relaxed">{req.description}</p>
                    <span className="font-mono text-xs text-muted-foreground">{req.code}</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-end gap-1 pt-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingComponent(component)
                    setAddOpen(true)
                  }}
                >
                  <PencilIcon className="size-4" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteComponent(component.id)}
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

      <ComponentAddDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
        requirements={requirements}
        editingId={editingComponent?.id}
        initialValues={
          editingComponent
            ? {
                name: editingComponent.name,
                description: editingComponent.description ?? "",
                quantity: String(editingComponent.quantity),
                unitPrice: String(editingComponent.unitPrice),
                requirementId: editingComponent.requirementId ?? "__none__",
              }
            : undefined
        }
        onSaved={reloadComponents}
      />

      <ComponentSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        projectId={projectId}
        existingNames={existingNames}
        onAdded={reloadComponents}
      />
    </div>
  )
}
