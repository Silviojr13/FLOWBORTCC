"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  CheckIcon,
  CpuIcon,
  SearchIcon,
  TagIcon,
  WalletIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  COMPONENT_CATALOG,
  COMPONENT_CATEGORIES,
  type CatalogComponent,
} from "@/lib/component-catalog"
import { setComponentOrigin } from "@/lib/component-origin-store"

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

type SortOption = "name" | "price-asc" | "price-desc"

export function ComponentSearchSheet({
  open,
  onOpenChange,
  projectId,
  existingNames,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  existingNames: string[]
  onAdded: () => void
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [sort, setSort] = useState<SortOption>("name")
  const [priceMin, setPriceMin] = useState("")
  const [priceMax, setPriceMax] = useState("")
  const [hideAdded, setHideAdded] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  function isItemAdded(item: CatalogComponent) {
    return (
      addedIds.has(item.id) ||
      existingNames.some((n) => n.toLowerCase() === item.name.toLowerCase())
    )
  }

  const results = useMemo(() => {
    let items = [...COMPONENT_CATALOG]

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
    }

    if (category !== "all") {
      items = items.filter((item) => item.category === category)
    }

    const min = priceMin.trim() ? Number(priceMin) : null
    const max = priceMax.trim() ? Number(priceMax) : null
    if (min !== null && Number.isFinite(min)) {
      items = items.filter((item) => item.referenceMaxPrice >= min)
    }
    if (max !== null && Number.isFinite(max)) {
      items = items.filter((item) => item.referenceMinPrice <= max)
    }

    if (hideAdded) {
      items = items.filter((item) => !isItemAdded(item))
    }

    items.sort((a, b) => {
      const avgA = (a.referenceMinPrice + a.referenceMaxPrice) / 2
      const avgB = (b.referenceMinPrice + b.referenceMaxPrice) / 2
      if (sort === "price-asc") return avgA - avgB
      if (sort === "price-desc") return avgB - avgA
      return a.name.localeCompare(b.name, "pt-BR")
    })

    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, sort, priceMin, priceMax, hideAdded, existingNames, addedIds])

  function clearFilters() {
    setQuery("")
    setCategory("all")
    setSort("name")
    setPriceMin("")
    setPriceMax("")
    setHideAdded(false)
  }

  async function addCatalogItem(item: CatalogComponent) {
    if (addingId || isItemAdded(item)) return

    setAddingId(item.id)
    try {
      const avgPrice =
        Math.round(((item.referenceMinPrice + item.referenceMaxPrice) / 2) * 100) / 100

      const res = await fetch(`/api/projects/${projectId}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          description: item.description,
          quantity: 1,
          unitPrice: avgPrice,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar componente")

      setComponentOrigin(projectId, data.component.id, "manual")
      setAddedIds((prev) => new Set(prev).add(item.id))
      existingNames.push(item.name)
      toast.success(`${item.name} adicionado ao projeto.`)
      onAdded()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar componente.")
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex h-auto max-h-[88vh] w-[calc(100%-2rem)] max-w-6xl flex-col overflow-hidden rounded-t-2xl border-x border-t px-0 pb-0 sm:w-[calc(100%-3rem)]"
        showCloseButton
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 pb-4 pt-2 sm:px-6">
          <SheetTitle>Buscar componentes</SheetTitle>
          <SheetDescription>
            Catálogo de referência para prototipagem. Valores são estimativas — confirme antes de
            comprar.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, descrição ou categoria..."
              className="pl-9"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Categoria</span>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {COMPONENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Preço mín. (ref.)</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="R$ 0"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Preço máx. (ref.)</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Sem limite"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Ordenar por</span>
              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="price-asc">Menor preço (ref.)</SelectItem>
                  <SelectItem value="price-desc">Maior preço (ref.)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="hide-added"
                checked={hideAdded}
                onCheckedChange={(v) => setHideAdded(v === true)}
              />
              <Label htmlFor="hide-added" className="text-sm font-normal">
                Apenas não adicionados
              </Label>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{results.length} resultado(s)</span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          </div>

          {results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum componente encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((item) => {
                const isAdded = isItemAdded(item)
                const isAdding = addingId === item.id
                return (
                  <Card key={item.id} className="bg-card/95">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm leading-snug">{item.name}</CardTitle>
                        <Badge variant="secondary" className="shrink-0 gap-0.5 text-[10px]">
                          <TagIcon className="size-2.5" aria-hidden />
                          {item.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 pt-0">
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <WalletIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        {currency.format(item.referenceMinPrice)} –{" "}
                        {currency.format(item.referenceMaxPrice)}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Preço de referência</p>
                    </CardContent>
                    <CardFooter>
                      <Button
                        size="sm"
                        className="w-full gap-1.5"
                        variant={isAdded ? "outline" : "default"}
                        disabled={isAdded || isAdding}
                        onClick={() => addCatalogItem(item)}
                      >
                        {isAdded ? (
                          <>
                            <CheckIcon className="size-3.5" aria-hidden />
                            Adicionado
                          </>
                        ) : isAdding ? (
                          "Adicionando..."
                        ) : (
                          <>
                            <CpuIcon className="size-3.5" aria-hidden />
                            Adicionar ao projeto
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
