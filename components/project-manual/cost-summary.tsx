"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ComponentCost {
  id: string
  name: string
  quantity: number
  unitPrice: number
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function CostSummary({ projectId }: { projectId: string }) {
  const [components, setComponents] = useState<ComponentCost[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/projects/${projectId}/components`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao carregar custos")
        if (!cancelled) {
          setComponents(data.components)
          setTotalCost(data.totalCost)
        }
      })
      .catch((error) => {
        console.error(error)
        toast.error("Não foi possível carregar o resumo de custos.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [projectId])

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Calculando custo do projeto...</p>
  }

  if (components.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum componente cadastrado ainda — volte para a aba Componentes para adicionar peças
          e ver o custo estimado aqui.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-1 py-6">
          <span className="text-sm text-muted-foreground">Custo total estimado do projeto</span>
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            {currency.format(totalCost)}
          </span>
          <span className="text-xs text-muted-foreground">
            Com base em {components.length} componente(s) cadastrado(s)
          </span>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Componente</TableHead>
              <TableHead className="w-20">Qtd.</TableHead>
              <TableHead className="w-28">Preço unit.</TableHead>
              <TableHead className="w-28">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {components.map((component) => (
              <TableRow key={component.id}>
                <TableCell>{component.name}</TableCell>
                <TableCell>{component.quantity}</TableCell>
                <TableCell>{currency.format(component.unitPrice)}</TableCell>
                <TableCell className="font-medium">
                  {currency.format(component.quantity * component.unitPrice)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="text-right font-medium">Total</TableCell>
              <TableCell className="font-semibold">{currency.format(totalCost)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}
