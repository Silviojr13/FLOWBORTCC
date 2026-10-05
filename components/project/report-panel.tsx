"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  ChevronDownIcon,
  FileDownIcon,
  FileTextIcon,
  LoaderCircleIcon,
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReportView } from "@/components/project/report-view"
import {
  CSV_TABLES,
  CSV_TABLE_LABELS,
  REPORT_FILTER_NONE,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  type ReportType,
} from "@/lib/report"
import { reportQueryString, useProjectReport, type ReportQuery } from "@/lib/use-project-report"
import { markStudyTaskDone } from "@/lib/use-study-me"
import { useProjectPermissions } from "@/components/project/project-permissions-context"

// O Select não aceita valor vazio: "__all__" representa "todos" na interface.
const ALL = "__all__"

const EMPTY_QUERY: ReportQuery = { type: "completo", from: "", to: "", sprint: "", assignee: "", feature: "" }

function FilterSelect({
  label,
  value,
  onChange,
  options,
  noneLabel,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  noneLabel: string
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={REPORT_FILTER_NONE}>{noneLabel}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )
}

// Tela de relatórios (UC11): escolhe tipo, período e filtros, visualiza e exporta (RF15).
export function ReportPanel({ projectId }: { projectId: string }) {
  // Sem acesso a custos, o tipo "Custos" some da lista (e o servidor também o recusa).
  const reportTypes = useProjectPermissions().canSeeCosts
    ? REPORT_TYPES
    : REPORT_TYPES.filter((t) => t !== "custos")
  const [draft, setDraft] = useState<ReportQuery>(EMPTY_QUERY)
  const [query, setQuery] = useState<ReportQuery>(draft)
  const { report, error, isLoading } = useProjectReport(projectId, query)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const invalidPeriod = !!draft.from && !!draft.to && draft.to < draft.from
  const isDirty = reportQueryString(draft) !== reportQueryString(query)
  const hasRefinement = !!query.from || !!query.to || !!query.sprint || !!query.assignee || !!query.feature
  const draftHasRefinement = !!draft.from || !!draft.to || !!draft.sprint || !!draft.assignee || !!draft.feature

  const apiBase = `/api/projects/${projectId}/report`
  const options = report?.filterOptions

  function apply() {
    if (invalidPeriod) return
    setQuery(draft)
  }

  function clearRefinements() {
    const next = { ...EMPTY_QUERY, type: draft.type }
    setDraft(next)
    setQuery(next)
  }

  async function exportPdf() {
    if (!report) return
    setIsExportingPdf(true)
    try {
      const { downloadReportPdf } = await import("@/lib/report-pdf")
      await downloadReportPdf(report)
      // Avaliação de usabilidade: o PDF é gerado no navegador, então a própria tela avisa.
      markStudyTaskDone("relatorio")
    } catch (err) {
      console.error(err)
      toast.error("Não foi possível gerar o PDF.")
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Parâmetros (UC11 passo 2: tipo, período e filtros) */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" data-tour="report-filters">
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
                {reportTypes.map((t) => (
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

        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect
            label="Sprint"
            value={draft.sprint ?? ""}
            onChange={(sprint) => setDraft((d) => ({ ...d, sprint }))}
            options={(options?.sprints ?? []).map((s) => ({ value: s.id, label: s.name }))}
            noneLabel="Sem sprint"
          />
          <FilterSelect
            label="Responsável"
            value={draft.assignee ?? ""}
            onChange={(assignee) => setDraft((d) => ({ ...d, assignee }))}
            options={(options?.assignees ?? []).map((a) => ({ value: a, label: a }))}
            noneLabel="Sem responsável"
          />
          <FilterSelect
            label="Funcionalidade"
            value={draft.feature ?? ""}
            onChange={(feature) => setDraft((d) => ({ ...d, feature }))}
            options={(options?.features ?? []).map((f) => ({ value: f.id, label: f.name }))}
            noneLabel="Sem funcionalidade"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!isDirty || invalidPeriod} onClick={apply}>
            Gerar relatório
          </Button>
          {draftHasRefinement && (
            <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={clearRefinements}>
              <XIcon className="size-3.5" />
              Limpar filtros
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {invalidPeriod
              ? "A data final deve ser igual ou posterior à inicial."
              : "Período, sprint, responsável e funcionalidade recortam as tarefas e o progresso. Requisitos, componentes e recursos aparecem sempre completos."}
          </p>
        </div>
      </div>

      {/* Exportação (RF15) */}
      <div className="flex flex-wrap items-center gap-2" data-tour="report-exports">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!report || isExportingPdf}
          onClick={() => void exportPdf()}
        >
          {isExportingPdf ? <LoaderCircleIcon className="size-4 animate-spin" /> : <FileDownIcon className="size-4" />}
          Exportar PDF
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

        {hasRefinement && report && (
          <span className="text-xs text-muted-foreground">
            Exportações usam o mesmo tipo, período e filtros do relatório exibido.
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
