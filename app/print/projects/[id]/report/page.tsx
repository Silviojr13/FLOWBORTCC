"use client"

import { Suspense, useEffect, useRef } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { PrinterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReportView } from "@/components/project/report-view"
import { isReportType, reportFileStem } from "@/lib/report"
import { useProjectReport } from "@/lib/use-project-report"

// Versão de impressão do relatório (RF15 — PDF): página limpa, fora do layout do dashboard,
// que abre o diálogo de impressão do navegador assim que os dados carregam.
function PrintableReport() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get("type")
  const query = {
    type: isReportType(typeParam) ? typeParam : ("completo" as const),
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  }
  const { report, error, isLoading } = useProjectReport(id, query)
  const printedRef = useRef(false)

  useEffect(() => {
    if (!report || printedRef.current) return
    printedRef.current = true
    const previousTitle = document.title
    // O navegador usa o título da aba como nome sugerido do PDF.
    document.title = reportFileStem(report)
    const timer = window.setTimeout(() => window.print(), 300)
    return () => {
      window.clearTimeout(timer)
      document.title = previousTitle
    }
  }, [report])

  if (isLoading && !report) {
    return <p className="p-8 text-sm text-muted-foreground">Preparando o relatório para impressão...</p>
  }

  if (error || !report) {
    return (
      <p className="p-8 text-sm text-destructive">{error ?? "Não foi possível gerar o relatório."}</p>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-6 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          Use “Salvar como PDF” no diálogo de impressão. Se ele não abrir, clique ao lado.
        </span>
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <PrinterIcon className="size-4" />
          Imprimir / PDF
        </Button>
      </div>
      <ReportView report={report} />
    </main>
  )
}

export default function PrintReportPage() {
  return (
    <Suspense>
      <PrintableReport />
    </Suspense>
  )
}
