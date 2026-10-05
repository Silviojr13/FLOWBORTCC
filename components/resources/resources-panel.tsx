"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useProjectPermissions } from "@/components/project/project-permissions-context"
import { ResourceDialog } from "@/components/resources/resource-dialog"
import {
  RESOURCE_AVAILABILITY_LABELS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  buildBudget,
  describeResourceCost,
  resourceCost,
  type Resource,
  type ResourceType,
} from "@/lib/resources"
import { cn } from "@/lib/utils"

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const money = (value: number) => currency.format(value)

type TypeFilter = ResourceType | "todos"
type AvailabilityFilter = "todos" | "disponivel" | "adquirir"

interface ComponentItem {
  quantity: number
  unitPrice: number
  domain?: string
}

interface RequirementOption {
  id: string
  code: string
  description: string
}

function SummaryCard({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string
  value: string
  hint: string
  emphasis?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3",
        emphasis ? "border-primary/30 bg-primary/5" : "border-border"
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

export function ResourcesPanel({ projectId }: { projectId: string }) {
  const editable = useProjectPermissions().canEdit.recursos
  const [resources, setResources] = useState<Resource[]>([])
  const [components, setComponents] = useState<ComponentItem[]>([])
  const [requirements, setRequirements] = useState<RequirementOption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todos")
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("todos")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)

  // Incrementado após salvar um recurso: dispara a recarga dos dados.
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/projects/${projectId}/resources`).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch(`/api/projects/${projectId}/components`).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch(`/api/projects/${projectId}/requirements`).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
    ])
      .then(([res, comp, req]) => {
        if (cancelled) return
        if (!res.ok) throw new Error(res.d.error || "Não foi possível carregar os recursos.")
        setResources(res.d.resources)
        if (comp.ok) setComponents(comp.d.components)
        if (req.ok) setRequirements(req.d.requirements)
      })
      .catch((error) => !cancelled && toast.error(error.message))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [projectId, refreshToken])

  const budget = useMemo(() => buildBudget(components, resources), [components, resources])
  const requirementCode = useMemo(
    () => new Map(requirements.map((r) => [r.id, r.code])),
    [requirements]
  )

  const visible = resources
    .filter(
      (r) =>
        (typeFilter === "todos" || r.type === typeFilter) &&
        (availabilityFilter === "todos" || r.availability === availabilityFilter)
    )
    .sort((a, b) => RESOURCE_TYPES.indexOf(a.type) - RESOURCE_TYPES.indexOf(b.type))
  const visibleTotal = visible.reduce((sum, r) => sum + resourceCost(r), 0)

  const componentsTotal = budget.componentsHardware + budget.componentsSoftware
  const resourcesTotal = budget.total - componentsTotal

  // Distribuição do orçamento por categoria, para a barra empilhada.
  const slices = [
    { label: "Componentes de hardware", value: budget.componentsHardware, color: "bg-sky-500" },
    { label: "Componentes de software", value: budget.componentsSoftware, color: "bg-indigo-500" },
    ...RESOURCE_TYPES.map((t, i) => ({
      label: RESOURCE_TYPE_LABELS[t],
      value: budget.resourcesByType[t],
      color: ["bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500", "bg-slate-400"][i],
    })),
  ].filter((s) => s.value > 0)

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  async function remove(resource: Resource) {
    if (!window.confirm(`Excluir o recurso "${resource.name}"?`)) return
    const res = await fetch(`/api/projects/${projectId}/resources/${resource.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Não foi possível excluir o recurso.")
      return
    }
    setResources((list) => list.filter((r) => r.id !== resource.id))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Orçamento consolidado */}
      <section className="flex flex-col gap-3" data-tour="resources-budget">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            emphasis
            label="Orçamento total"
            value={money(budget.total)}
            hint="componentes + recursos"
          />
          <SummaryCard
            label="Desembolso necessário"
            value={money(budget.toSpend)}
            hint="componentes e recursos a adquirir"
          />
          <SummaryCard
            label="Recursos já disponíveis"
            value={money(budget.resourcesAvailable)}
            hint="custo de uso do que a organização já tem"
          />
          <SummaryCard
            label="Componentes"
            value={money(componentsTotal)}
            hint={`hardware ${money(budget.componentsHardware)} · software ${money(budget.componentsSoftware)}`}
          />
        </div>

        {budget.total > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Distribuição do orçamento</p>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              {slices.map((s) => (
                <span key={s.label} className={s.color} style={{ width: `${(s.value / budget.total) * 100}%` }} />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {slices.map((s) => (
                <li key={s.label} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", s.color)} aria-hidden />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium tabular-nums">{money(s.value)}</span>
                  <span className="text-muted-foreground">({Math.round((s.value / budget.total) * 100)}%)</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Componentes são editados na aba{" "}
              <Link href={`/dashboard/projects/${projectId}/components-costs`} className="text-primary underline-offset-2 hover:underline">
                Componentes
              </Link>
              ; aqui ficam pessoas, equipamentos, software e serviços e espaços.
            </p>
          </div>
        )}
      </section>

      {/* Lista de recursos */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
            {(["todos", ...RESOURCE_TYPES] as TypeFilter[]).map((t) => {
              const count = t === "todos" ? resources.length : resources.filter((r) => r.type === t).length
              return (
                <Button
                  key={t}
                  size="sm"
                  variant={typeFilter === t ? "default" : "outline"}
                  className="h-8"
                  onClick={() => setTypeFilter(t)}
                >
                  {t === "todos" ? "Todos" : RESOURCE_TYPE_LABELS[t]}
                  <span className="tabular-nums opacity-70">{count}</span>
                </Button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Filtrar por disponibilidade">
              {(["todos", "disponivel", "adquirir"] as AvailabilityFilter[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvailabilityFilter(a)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    availabilityFilter === a ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {a === "todos" ? "Todos" : RESOURCE_AVAILABILITY_LABELS[a]}
                </button>
              ))}
            </div>
            {editable && (
              <Button size="sm" onClick={openNew} data-tour="resources-add">
                <PlusIcon />
                Adicionar recurso
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando recursos...</p>
        ) : resources.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Cadastre quem trabalha no projeto, os equipamentos, as licenças e os espaços usados. Cada
              recurso tem um custo por hora, por mês ou único, e pode ser algo que a organização já tem
              ou que precisa adquirir.
            </p>
            {editable && (
              <Button size="sm" onClick={openNew}>
                <PlusIcon />
                Adicionar o primeiro recurso
              </Button>
            )}
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Nenhum recurso com esses filtros.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Recurso</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2.5 text-left font-medium">Disponibilidade</th>
                  <th className="px-4 py-2.5 text-left font-medium">Cálculo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Custo</th>
                  <th className="px-4 py-2.5 text-left font-medium">Requisito</th>
                  <th className="px-2 py-2.5" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <span className="font-medium">{r.name}</span>
                      {r.description && (
                        <span className="block max-w-sm text-xs text-muted-foreground">{r.description}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{RESOURCE_TYPE_LABELS[r.type]}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "whitespace-nowrap",
                          r.availability === "adquirir"
                            ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                            : "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                        )}
                      >
                        {RESOURCE_AVAILABILITY_LABELS[r.availability]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {describeResourceCost(r, money)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                      {money(resourceCost(r))}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.requirementId ? requirementCode.get(r.requirementId) ?? "—" : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {editable && (
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`Editar ${r.name}`}
                            onClick={() => {
                              setEditing(r)
                              setDialogOpen(true)
                            }}
                          >
                            <PencilIcon className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Excluir ${r.name}`}
                            onClick={() => void remove(r)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/30">
                  <td colSpan={4} className="px-4 py-2.5 text-xs text-muted-foreground">
                    {visible.length} recurso(s){visible.length !== resources.length && " filtrado(s)"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(visibleTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {!isLoading && resourcesTotal > 0 && (
          <p className="text-right text-xs text-muted-foreground">
            Total em recursos: <span className="font-medium text-foreground">{money(resourcesTotal)}</span>
          </p>
        )}
      </section>

      <ResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        resource={editing}
        defaultType={typeFilter === "todos" ? "pessoa" : typeFilter}
        requirements={requirements}
        onSaved={() => setRefreshToken((t) => t + 1)}
      />
    </div>
  )
}
