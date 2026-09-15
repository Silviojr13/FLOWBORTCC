// Tipos e serializadores do relatório consolidado do projeto (RF13, RF15, UC11).
// Sem dependências de servidor: usado tanto pela API quanto pelas telas.

export const REPORT_TYPES = ["completo", "progresso", "requisitos", "custos"] as const
export type ReportType = (typeof REPORT_TYPES)[number]

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  completo: "Completo",
  progresso: "Progresso (sprints e tarefas)",
  requisitos: "Requisitos e rastreabilidade",
  custos: "Componentes e custos",
}

export function isReportType(value: unknown): value is ReportType {
  return typeof value === "string" && (REPORT_TYPES as readonly string[]).includes(value)
}

// Seções incluídas em cada tipo de relatório.
export const REPORT_SECTIONS: Record<ReportType, ReportSection[]> = {
  completo: ["summary", "sprints", "modules", "columns", "requirements", "tasks", "components"],
  progresso: ["summary", "sprints", "modules", "columns", "tasks"],
  requisitos: ["summary", "requirements", "tasks"],
  custos: ["summary", "components"],
}

export type ReportSection =
  | "summary"
  | "sprints"
  | "modules"
  | "columns"
  | "requirements"
  | "tasks"
  | "components"

export const CSV_TABLES = ["tasks", "requirements", "components", "sprints"] as const
export type CsvTable = (typeof CSV_TABLES)[number]

export const CSV_TABLE_LABELS: Record<CsvTable, string> = {
  tasks: "Tarefas",
  requirements: "Requisitos",
  components: "Componentes",
  sprints: "Sprints",
}

export function isCsvTable(value: unknown): value is CsvTable {
  return typeof value === "string" && (CSV_TABLES as readonly string[]).includes(value)
}

export interface ProjectReport {
  generatedAt: string
  type: ReportType
  period: { from: string | null; to: string | null }
  hasDataInPeriod: boolean
  project: {
    id: string
    name: string
    description: string | null
    startDate: string | null
    endDate: string | null
    createdAt: string
  }
  summary: {
    requirementsTotal: number
    requirementsByCategory: Record<string, number>
    requirementsByStatus: Record<string, number>
    requirementsUncovered: number
    featuresTotal: number
    tasksTotal: number
    tasksDone: number
    tasksOverdue: number
    progressPct: number
    sprintsTotal: number
    componentsTotal: number
    totalCost: number
  }
  sprints: {
    id: string
    name: string
    goal: string | null
    startDate: string
    endDate: string
    status: string
    tasksTotal: number
    tasksDone: number
    pct: number
  }[]
  // Progresso por módulo (RF13): módulo = funcionalidade do projeto.
  modules: { name: string; tasksTotal: number; tasksDone: number; pct: number }[]
  columns: { name: string; isDone: boolean; count: number }[]
  requirements: {
    code: string
    description: string
    category: string
    priority: string
    status: string
    level: string | null
    tasksTotal: number
    tasksDone: number
  }[]
  uncoveredRequirements: { code: string; description: string }[]
  tasks: {
    title: string
    column: string
    isDone: boolean
    priority: string
    assignee: string | null
    dueDate: string | null
    overdue: boolean
    requirementCode: string | null
    featureName: string | null
    sprintName: string | null
  }[]
  components: {
    name: string
    description: string | null
    quantity: number
    unitPrice: number
    subtotal: number
    requirementCode: string | null
  }[]
}

/* ------------------------------------------------------------------ */
/*  Formatação                                                         */
/* ------------------------------------------------------------------ */

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function formatCurrency(value: number) {
  return currency.format(value)
}

export function formatReportDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

export function formatReportDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function periodLabel(period: ProjectReport["period"]) {
  if (!period.from && !period.to) return "Todo o projeto"
  return `${formatReportDate(period.from) === "—" ? "início" : formatReportDate(period.from)} – ${
    formatReportDate(period.to) === "—" ? "hoje" : formatReportDate(period.to)
  }`
}

export function reportFileStem(report: ProjectReport) {
  const slug = report.project.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
  return `flowbot-relatorio-${slug || "projeto"}-${report.generatedAt.slice(0, 10)}`
}

/* ------------------------------------------------------------------ */
/*  Markdown (RF15 / Sprint 2)                                          */
/* ------------------------------------------------------------------ */

function mdCell(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—"
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ")
}

function mdTable(headers: string[], rows: (string | number | null | undefined)[][]) {
  if (rows.length === 0) return "_Nenhum registro._\n"
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(mdCell).join(" | ")} |`),
  ]
  return lines.join("\n") + "\n"
}

export function reportToMarkdown(report: ProjectReport): string {
  const sections = new Set(REPORT_SECTIONS[report.type])
  const s = report.summary
  const out: string[] = []

  out.push(`# Relatório do projeto — ${report.project.name}`)
  out.push("")
  out.push(`- **Tipo:** ${REPORT_TYPE_LABELS[report.type]}`)
  out.push(`- **Período:** ${periodLabel(report.period)}`)
  out.push(`- **Gerado em:** ${formatReportDateTime(report.generatedAt)}`)
  if (report.project.description) out.push(`- **Descrição:** ${report.project.description}`)
  if (report.project.startDate || report.project.endDate) {
    out.push(
      `- **Cronograma:** ${formatReportDate(report.project.startDate)} – ${formatReportDate(report.project.endDate)}`
    )
  }
  out.push("")

  if (!report.hasDataInPeriod) {
    out.push("> Não há tarefas nem sprints no período selecionado.")
    out.push("")
  }

  if (sections.has("summary")) {
    out.push("## Resumo")
    out.push("")
    out.push(mdTable(
      ["Indicador", "Valor"],
      [
        ["Requisitos", `${s.requirementsTotal} (${s.requirementsByCategory["Funcional"] ?? 0} funcionais, ${s.requirementsByCategory["Não Funcional"] ?? 0} não funcionais)`],
        ["Requisitos sem tarefa vinculada", s.requirementsUncovered],
        ["Funcionalidades", s.featuresTotal],
        ["Tarefas", `${s.tasksTotal} (${s.tasksDone} concluídas · ${s.progressPct}%)`],
        ["Tarefas em atraso", s.tasksOverdue],
        ["Sprints", s.sprintsTotal],
        ["Componentes", s.componentsTotal],
        ["Custo total estimado", formatCurrency(s.totalCost)],
      ]
    ))
    out.push("")
  }

  if (sections.has("sprints")) {
    out.push("## Progresso por sprint")
    out.push("")
    out.push(mdTable(
      ["Sprint", "Período", "Status", "Tarefas", "Concluídas", "%"],
      report.sprints.map((sp) => [
        sp.name,
        `${formatReportDate(sp.startDate)} – ${formatReportDate(sp.endDate)}`,
        sp.status,
        sp.tasksTotal,
        sp.tasksDone,
        `${sp.pct}%`,
      ])
    ))
    out.push("")
  }

  if (sections.has("modules")) {
    out.push("## Progresso por módulo (funcionalidade)")
    out.push("")
    out.push(mdTable(
      ["Módulo", "Tarefas", "Concluídas", "%"],
      report.modules.map((m) => [m.name, m.tasksTotal, m.tasksDone, `${m.pct}%`])
    ))
    out.push("")
  }

  if (sections.has("columns")) {
    out.push("## Tarefas por coluna do Kanban")
    out.push("")
    out.push(mdTable(
      ["Coluna", "Tarefas", "Conta como concluída"],
      report.columns.map((c) => [c.name, c.count, c.isDone ? "Sim" : "Não"])
    ))
    out.push("")
  }

  if (sections.has("requirements")) {
    out.push("## Requisitos e rastreabilidade")
    out.push("")
    out.push(mdTable(
      ["Código", "Descrição", "Categoria", "Prioridade", "Status", "Nível", "Tarefas (concl./total)"],
      report.requirements.map((r) => [
        r.code,
        r.description,
        r.category,
        r.priority,
        r.status,
        r.level,
        `${r.tasksDone}/${r.tasksTotal}`,
      ])
    ))
    out.push("")
    if (report.uncoveredRequirements.length > 0) {
      out.push("### Requisitos sem cobertura")
      out.push("")
      for (const r of report.uncoveredRequirements) out.push(`- **${r.code}** — ${r.description}`)
      out.push("")
    }
  }

  if (sections.has("tasks")) {
    out.push("## Tarefas")
    out.push("")
    out.push(mdTable(
      ["Tarefa", "Coluna", "Prioridade", "Responsável", "Prazo", "Requisito", "Funcionalidade", "Sprint"],
      report.tasks.map((t) => [
        t.title,
        t.column,
        t.priority,
        t.assignee,
        t.dueDate ? `${formatReportDate(t.dueDate)}${t.overdue ? " (atrasada)" : ""}` : null,
        t.requirementCode,
        t.featureName,
        t.sprintName,
      ])
    ))
    out.push("")
  }

  if (sections.has("components")) {
    out.push("## Componentes e custos")
    out.push("")
    out.push(mdTable(
      ["Componente", "Descrição", "Qtd.", "Preço unit.", "Subtotal", "Requisito"],
      report.components.map((c) => [
        c.name,
        c.description,
        c.quantity,
        formatCurrency(c.unitPrice),
        formatCurrency(c.subtotal),
        c.requirementCode,
      ])
    ))
    out.push("")
    out.push(`**Custo total estimado:** ${formatCurrency(s.totalCost)}`)
    out.push("")
  }

  out.push("---")
  out.push("_Gerado pelo FlowBot._")
  return out.join("\n")
}

/* ------------------------------------------------------------------ */
/*  CSV (RF15)                                                         */
/* ------------------------------------------------------------------ */

function csvCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return ""
  const text = typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value)
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Separador ";" e BOM UTF-8 para o Excel em pt-BR abrir com colunas e acentos corretos.
function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const lines = [headers.map(csvCell).join(";"), ...rows.map((r) => r.map(csvCell).join(";"))]
  return "﻿" + lines.join("\r\n") + "\r\n"
}

export function reportTableToCsv(report: ProjectReport, table: CsvTable): string {
  switch (table) {
    case "tasks":
      return toCsv(
        ["Tarefa", "Coluna", "Concluída", "Prioridade", "Responsável", "Prazo", "Atrasada", "Requisito", "Funcionalidade", "Sprint"],
        report.tasks.map((t) => [
          t.title,
          t.column,
          t.isDone,
          t.priority,
          t.assignee,
          t.dueDate ? t.dueDate.slice(0, 10) : null,
          t.overdue,
          t.requirementCode,
          t.featureName,
          t.sprintName,
        ])
      )
    case "requirements":
      return toCsv(
        ["Código", "Descrição", "Categoria", "Prioridade", "Status", "Nível", "Tarefas", "Tarefas concluídas"],
        report.requirements.map((r) => [
          r.code,
          r.description,
          r.category,
          r.priority,
          r.status,
          r.level,
          r.tasksTotal,
          r.tasksDone,
        ])
      )
    case "components":
      return toCsv(
        ["Componente", "Descrição", "Quantidade", "Preço unitário", "Subtotal", "Requisito"],
        report.components.map((c) => [
          c.name,
          c.description,
          c.quantity,
          c.unitPrice.toFixed(2).replace(".", ","),
          c.subtotal.toFixed(2).replace(".", ","),
          c.requirementCode,
        ])
      )
    case "sprints":
      return toCsv(
        ["Sprint", "Objetivo", "Início", "Término", "Status", "Tarefas", "Concluídas", "Percentual"],
        report.sprints.map((sp) => [
          sp.name,
          sp.goal,
          sp.startDate.slice(0, 10),
          sp.endDate.slice(0, 10),
          sp.status,
          sp.tasksTotal,
          sp.tasksDone,
          sp.pct,
        ])
      )
  }
}
