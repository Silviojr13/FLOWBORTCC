"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CircleCheckIcon } from "lucide-react"
import { MANUAL_STEP_CONTENT } from "@/lib/manual-step-content"
import { FEATURE_STATUSES } from "@/lib/feature-status"

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function ProjectCreationSummary({
  projectId,
  requirementsSkipped,
}: {
  projectId: string
  requirementsSkipped: boolean
}) {
  const router = useRouter()
  const stepContent = MANUAL_STEP_CONTENT.finalizar
  const [summary, setSummary] = useState<{
    requirementsCount: number
    featuresTotal: number
    featuresByStatus: Record<string, number>
    componentsCount: number
    totalCost: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const [reqRes, featRes, compRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/requirements`),
          fetch(`/api/projects/${projectId}/features`),
          fetch(`/api/projects/${projectId}/components`),
        ])
        const [reqData, featData, compData] = await Promise.all([
          reqRes.json(),
          featRes.json(),
          compRes.json(),
        ])

        if (cancelled) return

        const features = featRes.ok ? featData.features : []
        const byStatus: Record<string, number> = {}
        for (const s of FEATURE_STATUSES) byStatus[s] = 0
        for (const f of features) {
          if (f.status in byStatus) byStatus[f.status]++
        }

        const components = compRes.ok ? compData.components : []
        const totalCost = components.reduce(
          (sum: number, c: { quantity: number; unitPrice: number }) =>
            sum + c.quantity * c.unitPrice,
          0
        )

        setSummary({
          requirementsCount: reqRes.ok ? reqData.requirements.length : 0,
          featuresTotal: features.length,
          featuresByStatus: byStatus,
          componentsCount: components.length,
          totalCost,
        })
      } catch (error) {
        console.error(error)
        toast.error("Erro ao carregar resumo.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const requirementsLabel =
    summary && summary.requirementsCount === 0 && requirementsSkipped
      ? "Não definidos"
      : summary
        ? String(summary.requirementsCount)
        : "—"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{stepContent.title}</h2>
        <p className="text-sm text-muted-foreground">{stepContent.description}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 py-6">
          <div className="flex items-center gap-3">
            <CircleCheckIcon className="size-7 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-muted-foreground">
              Revise o que foi definido antes de concluir a criação ou ir direto ao Kanban.
            </p>
          </div>

          {isLoading && (
            <p className="text-sm text-muted-foreground">Carregando resumo...</p>
          )}

          {!isLoading && summary && (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">Requisitos</dt>
                <dd className="text-lg font-semibold">{requirementsLabel}</dd>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">Funcionalidades</dt>
                <dd className="text-lg font-semibold">{summary.featuresTotal}</dd>
                <dd className="text-xs text-muted-foreground">
                  {FEATURE_STATUSES.map(
                    (s) => `${s}: ${summary.featuresByStatus[s] ?? 0}`
                  ).join(" · ")}
                </dd>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">Componentes</dt>
                <dd className="text-lg font-semibold">{summary.componentsCount}</dd>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">Custo estimado</dt>
                <dd className="text-lg font-semibold">{currency.format(summary.totalCost)}</dd>
              </div>
            </dl>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild>
              <Link href={`/dashboard/projects/${projectId}/kanban`}>
                Ir para o Kanban
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/projects/${projectId}`)}
            >
              Concluir criação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
