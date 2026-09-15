"use client"

import { useState } from "react"
import {
  ChevronDownIcon,
  FileDownIcon,
  FileTextIcon,
  PrinterIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReportView } from "@/components/project/report-view"
import {
  CSV_TABLES,
  CSV_TABLE_LABELS,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  type ReportType,
} from "@/lib/report"
import { reportQueryString, useProjectReport, type ReportQuery } from "@/lib/use-project-report"

// Tela de relatórios (UC11): escolhe tipo e período, visualiza e exporta (RF15).
export function ReportPanel({ projectId }: { projectId: string }) {
  const [draft, setDraft] = useState<ReportQuery>({ type: "completo", from: "", to: "" })
  const [query, setQuery] = useState<ReportQuery>(draft)
  const { report, error, isLoading } = useProjectReport(projectId, query)

  const invalidPeriod = !!draft.from && !!draft.to && draft.to < draft.from
  const isDirty = draft.type !== query.type || draft.from !== query.from || draft.to !== query.to
  const hasPeriod = !!query.from || !!query.to

  const apiBase = `/api/projects/${projectId}/report`
  const printHref = `/print/projects/${projectId}/report?${reportQueryString(query)}`

  function apply() {
    if (invalidPeriod) return
    setQuery(draft)
  }

  function clearPeriod() {
    const next = { ...draft, from: "", to: "" }
    setDraft(next)
    setQuery(next)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Parâmetros (UC11 passo 2: tipo e período) */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/95 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field>
            <FieldLabel>Tipo de relatório</FieldLabel>
            <Select
              value={draft.type}
              onValueChange={(v) => setDraft((d) => ({ ...d, type: v as ReportType }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REPORT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="report-from">De</FieldLabel>
            <Input
              id="report-from"
              type="date"
              value={draft.from}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="report-to">Até</FieldLabel>
            <Input
              id="report-to"
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              aria-invalid={invalidPeriod}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!isDirty || invalidPeriod} onClick={apply}>
            Gerar relatório
          </Button>
          {(draft.from || draft.to) && (
            <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={clearPeriod}>
              <XIcon className="size-3.5" />
              Todo o projeto
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {invalidPeriod
              ? "A data final deve ser igual ou posterior à inicial."
              : "O período filtra tarefas pelo prazo (ou data de criação) e sprints que cruzam o intervalo."}
          </p>
        </div>
      </div>

      {/* Exportação (RF15) */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!report} asChild>
          <a href={printHref} target="_blank" rel="noopener">
            <PrinterIcon className="size-4" />
            Exportar PDF
          </a>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!report}>
              <FileDownIcon className="size-4" />
              Exportar CSV
              <ChevronDownIcon className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Tabela</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CSV_TABLES.map((table) => (
              <DropdownMenuItem key={table} asChild>
                <a href={`${apiBase}?${reportQueryString(query, { format: "csv", table })}`} download>
                  {CSV_TABLE_LABELS[table]}
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="outline" className="gap-1.5" disabled={!report} asChild>
          <a href={`${apiBase}?${reportQueryString(query, { format: "md" })}`} download>
            <FileTextIcon className="size-4" />
            Exportar Markdown
          </a>
        </Button>

        {hasPeriod && report && (
          <span className="text-xs text-muted-foreground">
            Exportações usam o mesmo tipo e período do relatório exibido.
          </span>
        )}
      </div>

      {/* Relatório */}
      {isLoading && !report && (
        <p className="py-8 text-center text-sm text-muted-foreground">Consolidando dados do projeto...</p>
      )}
      {error && !report && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {report && (
        <div className={isLoading ? "opacity-60 transition-opacity" : undefined}>
          <ReportView report={report} />
        </div>
      )}
    </div>
  )
}
