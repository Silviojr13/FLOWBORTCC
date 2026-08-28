"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  BatteryChargingIcon,
  BoxIcon,
  CogIcon,
  MicrochipIcon,
  PackageIcon,
  PlusIcon,
  RadarIcon,
  RefreshCwIcon,
  SparklesIcon,
  TriangleAlertIcon,
  WifiIcon,
  type LucideIcon,
} from "lucide-react"

interface Suggestion {
  category: string
  name: string
  description: string
  estimatedMinPrice: number
  estimatedMaxPrice: number
  reason: string
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

const CATEGORY_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  Sensor: { icon: RadarIcon, className: "bg-blue-500/10 text-blue-500" },
  Atuador: { icon: CogIcon, className: "bg-orange-500/10 text-orange-500" },
  Controlador: { icon: MicrochipIcon, className: "bg-purple-500/10 text-purple-500" },
  Alimentação: { icon: BatteryChargingIcon, className: "bg-emerald-500/10 text-emerald-500" },
  Conectividade: { icon: WifiIcon, className: "bg-cyan-500/10 text-cyan-500" },
  Estrutura: { icon: BoxIcon, className: "bg-amber-500/10 text-amber-500" },
  Outro: { icon: PackageIcon, className: "bg-slate-500/10 text-slate-500" },
}

function CategoryImage({ category }: { category: string }) {
  const { icon: Icon, className } = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.Outro
  return (
    <div className={`flex h-28 w-full items-center justify-center rounded-lg ${className}`}>
      <Icon className="size-14" strokeWidth={1.5} />
    </div>
  )
}

export function ComponentSuggestions({
  projectId,
  autoGenerate = false,
  onAdded,
}: {
  projectId: string
  autoGenerate?: boolean
  onAdded?: () => void
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set())

  async function generateSuggestions() {
    setIsGenerating(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/components/suggestions`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao gerar sugestões")
      setSuggestions(data.suggestions)
      setAddedNames(new Set())
      if (data.suggestions.length === 0) {
        setErrorMessage("A IA não encontrou sugestões desta vez.")
      }
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Erro ao gerar sugestões."
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setIsGenerating(false)
      setHasGenerated(true)
    }
  }

  // Projetos criados pelo Modo A (chat) geram a vitrine sozinhos, sem o usuário precisar pedir.
  useEffect(() => {
    if (!autoGenerate || hasGenerated) return
    let cancelled = false

    async function run() {
      if (!cancelled) await generateSuggestions()
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate])

  async function addToProject(suggestion: Suggestion) {
    try {
      const avgPrice = Math.round(
        ((suggestion.estimatedMinPrice + suggestion.estimatedMaxPrice) / 2) * 100
      ) / 100

      const res = await fetch(`/api/projects/${projectId}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: suggestion.name,
          quantity: 1,
          unitPrice: avgPrice,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar componente")

      setAddedNames((prev) => new Set(prev).add(suggestion.name))
      toast.success(`${suggestion.name} adicionado aos componentes do projeto.`)
      onAdded?.()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar componente.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">Vitrine de componentes (IA)</span>
          <span className="text-xs text-muted-foreground">
            Sugestões geradas com base nos requisitos e funcionalidades deste projeto. Preços e
            imagens são estimativas da IA por categoria, não fotos ou valores reais de loja —
            confirme antes de comprar.
          </span>
        </div>
        {!autoGenerate && (
          <Button
            size="sm"
            className="gap-1.5"
            disabled={isGenerating}
            onClick={generateSuggestions}
          >
            <SparklesIcon className="size-4" />
            {isGenerating ? "Gerando..." : suggestions.length > 0 ? "Gerar novamente" : "Gerar sugestões com IA"}
          </Button>
        )}
      </div>

      {isGenerating && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          <SparklesIcon className="size-4 animate-pulse" />
          {autoGenerate
            ? "Gerando sugestões automaticamente com base no que a IA já sabe sobre o seu projeto..."
            : "Gerando sugestões..."}
        </div>
      )}

      {!isGenerating && hasGenerated && suggestions.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          <TriangleAlertIcon className="size-5 text-amber-500" />
          <span>{errorMessage ?? "Não foi possível gerar sugestões."}</span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={generateSuggestions}>
            <RefreshCwIcon className="size-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((suggestion) => {
            const isAdded = addedNames.has(suggestion.name)
            return (
              <Card key={suggestion.name} className="justify-between">
                <CardHeader>
                  <CategoryImage category={suggestion.category} />
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <CardTitle>{suggestion.name}</CardTitle>
                    <Badge variant="outline" className="shrink-0">{suggestion.category}</Badge>
                  </div>
                  <CardDescription>{suggestion.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <span className="text-lg font-semibold tracking-tight text-foreground">
                    {currency.format(suggestion.estimatedMinPrice)} – {currency.format(suggestion.estimatedMaxPrice)}
                  </span>
                  <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                </CardContent>
                <CardFooter>
                  <Button
                    size="sm"
                    variant={isAdded ? "outline" : "default"}
                    disabled={isAdded}
                    className="w-full gap-1.5"
                    onClick={() => addToProject(suggestion)}
                  >
                    <PlusIcon className="size-4" />
                    {isAdded ? "Adicionado" : "Adicionar ao projeto"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
