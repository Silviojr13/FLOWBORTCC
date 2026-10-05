"use client"

import type { Content, ContextPageSize, TableCell, TDocumentDefinitions } from "pdfmake/interfaces"
import {
  REPORT_TYPE_LABELS,
  filtersLabel,
  formatCurrency,
  formatReportDate,
  formatReportDateTime,
  formatTaskTeam,
  reportSections,
  periodLabel,
  reportFileStem,
  type ProjectReport,
} from "./report"

/**
 * Relatório em PDF montado como documento (RF15): A4, margens de documento, cabeçalho e
 * rodapé próprios com numeração de páginas e tabelas que repetem o cabeçalho ao quebrar
 * de página. Substitui a impressão da página pelo navegador, que punha URL e data em
 * cada folha.
 */

const COLOR = {
  primary: "#1d4ed8",
  text: "#111827",
  muted: "#6b7280",
  line: "#d8dee6",
  headerFill: "#eef2f8",
  zebra: "#f8fafc",
  danger: "#b91c1c",
  warning: "#92400e",
  warningFill: "#fff7e6",
  success: "#047857",
}

// Só linhas horizontais finas, como uma tabela de documento de texto.
const TABLE_LAYOUT = {
  hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
    i === 0 || i === node.table.body.length ? 0.8 : 0.4,
  vLineWidth: () => 0,
  hLineColor: (i: number) => (i <= 1 ? "#9aa5b4" : COLOR.line),
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
  fillColor: (row: number) => (row === 0 ? COLOR.headerFill : row % 2 === 0 ? COLOR.zebra : null),
}

function cell(value: string | number | null | undefined, extra: Record<string, unknown> = {}): TableCell {
  const text = value === null || value === undefined || value === "" ? "—" : String(value)
  return { text, ...extra } as TableCell
}

function table(
  headers: string[],
  rows: TableCell[][],
  widths: (string | number)[],
  align: ("left" | "right" | "center")[] = []
): Content {
  if (rows.length === 0) {
    return { text: "Nenhum registro.", style: "muted", margin: [0, 2, 0, 8] }
  }
  const header = headers.map((h, i) => ({ text: h, style: "tableHeader", alignment: align[i] ?? "left" }))
  const body = rows.map((r) => r.map((c, i) => ({ ...(c as object), alignment: align[i] ?? "left" }) as TableCell))
  return {
    table: { headerRows: 1, dontBreakRows: true, widths, body: [header, ...body] },
    layout: TABLE_LAYOUT,
    style: "table",
  } as Content
}

function heading(number: number, title: string): Content {
  return {
    stack: [
      { text: `${number}. ${title}`, style: "h1" },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 0.6, lineColor: COLOR.line }],
        margin: [0, 3, 0, 8],
      },
    ],
    unbreakable: true,
  } as Content
}

function indicatorGrid(items: { label: string; value: string; hint?: string; color?: string }[]): Content {
  const rows: TableCell[][] = []
  for (let i = 0; i < items.length; i += 4) {
    const slice = items.slice(i, i + 4)
    while (slice.length < 4) slice.push({ label: "", value: "" })
    rows.push(
      slice.map((item) =>
        item.label
          ? ({
              stack: [
                { text: item.label, fontSize: 7.5, color: COLOR.muted },
                { text: item.value, fontSize: 13, bold: true, color: item.color ?? COLOR.text, margin: [0, 1, 0, 0] },
                ...(item.hint ? [{ text: item.hint, fontSize: 7, color: COLOR.muted }] : []),
              ],
              fillColor: COLOR.zebra,
            } as TableCell)
          : ({ text: "" } as TableCell)
      )
    )
  }
  return {
    table: { widths: ["*", "*", "*", "*"], body: rows },
    layout: {
      hLineWidth: () => 3,
      vLineWidth: () => 3,
      hLineColor: () => "#ffffff",
      vLineColor: () => "#ffffff",
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [-3, 0, -3, 8],
  } as Content
}

function buildDocument(report: ProjectReport): TDocumentDefinitions {
  const sections = reportSections(report)
  const s = report.summary
  const filters = filtersLabel(report.filters)
  const generated = formatReportDateTime(report.generatedAt)
  const content: Content[] = []
  let n = 0

  // Folha de rosto compacta: título e ficha do relatório.
  const meta: [string, string][] = [
    ["Tipo de relatório", REPORT_TYPE_LABELS[report.type]],
    ["Período", periodLabel(report.period)],
  ]
  if (report.project.startDate || report.project.endDate) {
    meta.push([
      "Cronograma do projeto",
      `${formatReportDate(report.project.startDate)} a ${formatReportDate(report.project.endDate)}`,
    ])
  }
  if (filters) meta.push(["Filtros", filters])
  meta.push(["Gerado em", generated])

  content.push(
    { text: "RELATÓRIO DO PROJETO", fontSize: 8, bold: true, color: COLOR.primary, characterSpacing: 1.2 },
    { text: report.project.name, style: "title" },
    ...(report.project.description
      ? [{ text: report.project.description, style: "lead" } as Content]
      : []),
    {
      table: {
        widths: [120, "*"],
        body: meta.map(([k, v]) => [
          { text: k, color: COLOR.muted, fontSize: 8.5 },
          { text: v, fontSize: 8.5 },
        ]),
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
          i === 0 || i === node.table.body.length ? 0.6 : 0,
        vLineWidth: () => 0,
        hLineColor: () => COLOR.line,
        paddingTop: () => 2.5,
        paddingBottom: () => 2.5,
        paddingLeft: () => 0,
      },
      margin: [0, 6, 0, 16],
    } as Content
  )

  if (!report.hasDataInPeriod) {
    content.push({
      text: "Não há tarefas nem sprints para o período e os filtros selecionados.",
      style: "notice",
    })
  }

  if (sections.has("summary")) {
    content.push(heading(++n, "Resumo"))
    content.push(
      indicatorGrid([
        {
          label: "Requisitos",
          value: String(s.requirementsTotal),
          hint: `${s.requirementsByCategory["Funcional"] ?? 0} funcionais · ${s.requirementsByCategory["Não Funcional"] ?? 0} não funcionais`,
        },
        {
          label: "Requisitos sem cobertura",
          value: String(s.requirementsUncovered),
          hint: "sem tarefa vinculada",
          color: s.requirementsUncovered > 0 ? COLOR.warning : undefined,
        },
        { label: "Tarefas", value: String(s.tasksTotal), hint: `${s.tasksDone} concluída(s)` },
        { label: "Progresso", value: `${s.progressPct}%`, hint: "tarefas concluídas" },
        {
          label: "Tarefas em atraso",
          value: String(s.tasksOverdue),
          color: s.tasksOverdue > 0 ? COLOR.danger : undefined,
        },
        { label: "Sprints", value: String(s.sprintsTotal), hint: `${s.featuresTotal} funcionalidade(s)` },
        ...(report.costsHidden
          ? [{ label: "Componentes", value: String(s.componentsTotal) }]
          : [
              {
                label: "Componentes · recursos",
                value: `${s.componentsTotal} · ${s.resourcesTotal}`,
                hint: `${formatCurrency(s.totalCost)} · ${formatCurrency(s.resourcesCost)}`,
              },
              {
                label: "Orçamento total",
                value: formatCurrency(s.budgetTotal),
                hint: `desembolso: ${formatCurrency(report.budget.toSpend)}`,
                color: COLOR.primary,
              },
            ]),
      ])
    )
    const statuses = Object.entries(s.requirementsByStatus)
    if (statuses.length > 0) {
      content.push({
        text: `Status dos requisitos: ${statuses.map(([k, v]) => `${k}: ${v}`).join(" · ")}`,
        style: "muted",
        margin: [0, 0, 0, 6],
      })
    }
  }

  if (sections.has("sprints")) {
    content.push(heading(++n, "Progresso por sprint"))
    content.push(
      table(
        ["Sprint", "Período", "Status", "Tarefas", "Concluídas", "Progresso"],
        report.sprints.map((sp) => [
          {
            stack: [
              { text: sp.name, bold: true },
              ...(sp.goal ? [{ text: sp.goal, fontSize: 7.5, color: COLOR.muted }] : []),
            ],
          } as TableCell,
          cell(`${formatReportDate(sp.startDate)} a ${formatReportDate(sp.endDate)}`),
          cell(sp.status),
          cell(sp.tasksTotal),
          cell(sp.tasksDone),
          cell(`${sp.pct}%`, { bold: true, color: sp.pct === 100 ? COLOR.success : COLOR.text }),
        ]),
        ["*", 95, 62, 42, 52, 52],
        ["left", "left", "left", "right", "right", "right"]
      )
    )
  }

  if (sections.has("modules")) {
    content.push(heading(++n, "Progresso por módulo (funcionalidade)"))
    content.push(
      table(
        ["Módulo", "Tarefas", "Concluídas", "Progresso"],
        report.modules.map((m) => [
          cell(m.name),
          cell(m.tasksTotal),
          cell(m.tasksDone),
          cell(`${m.pct}%`, { bold: true, color: m.pct === 100 ? COLOR.success : COLOR.text }),
        ]),
        ["*", 60, 60, 60],
        ["left", "right", "right", "right"]
      )
    )
  }

  if (sections.has("columns")) {
    content.push(heading(++n, "Tarefas por coluna do Kanban"))
    content.push(
      table(
        ["Coluna", "Tarefas", "Conta como concluída"],
        report.columns.map((c) => [cell(c.name), cell(c.count), cell(c.isDone ? "Sim" : "Não")]),
        ["*", 60, 120],
        ["left", "right", "left"]
      )
    )
  }

  if (sections.has("requirements")) {
    content.push(heading(++n, "Requisitos e rastreabilidade"))
    content.push(
      table(
        ["Código", "Descrição", "Categoria", "Prioridade", "Status", "Nível", "Tarefas"],
        report.requirements.map((r) => [
          cell(r.code, { bold: true }),
          cell(r.description),
          cell(r.category),
          cell(r.priority),
          cell(r.status),
          cell(r.level),
          cell(`${r.tasksDone}/${r.tasksTotal}`, {
            color: r.tasksTotal === 0 ? COLOR.warning : COLOR.text,
          }),
        ]),
        [36, "*", 52, 44, 48, 52, 34],
        ["left", "left", "left", "left", "left", "left", "center"]
      )
    )
    if (report.uncoveredRequirements.length > 0) {
      content.push({
        table: {
          widths: ["*"],
          body: [
            [
              {
                stack: [
                  {
                    text: `Requisitos sem cobertura (${report.uncoveredRequirements.length})`,
                    bold: true,
                    color: COLOR.warning,
                    margin: [0, 0, 0, 3],
                  },
                  {
                    ul: report.uncoveredRequirements.map((r) => ({
                      text: [{ text: `${r.code} `, bold: true }, r.description],
                    })),
                    fontSize: 8.5,
                  },
                ],
                fillColor: COLOR.warningFill,
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 10],
      } as Content)
    }
  }

  if (sections.has("tasks")) {
    content.push(heading(++n, "Tarefas"))
    content.push(
      table(
        ["Tarefa", "Coluna", "Prioridade", "Responsável", "Prazo", "Req."],
        report.tasks.map((t) => [
          // A sprint vai abaixo do título: uma coluna própria espremia o título em 3 linhas.
          {
            stack: [
              { text: t.title, color: t.isDone ? COLOR.muted : COLOR.text },
              ...(t.sprintName ? [{ text: t.sprintName, fontSize: 7, color: COLOR.muted }] : []),
            ],
          } as TableCell,
          cell(t.column),
          cell(t.priority),
          cell(formatTaskTeam(t)),
          cell(
            t.dueDate ? `${formatReportDate(t.dueDate)}${t.overdue ? " (atrasada)" : ""}` : null,
            t.overdue ? { color: COLOR.danger, bold: true } : {}
          ),
          cell(t.requirementCode),
        ]),
        ["*", 62, 46, 58, 56, 34]
      )
    )
  }

  if (sections.has("components")) {
    content.push(heading(++n, "Componentes"))
    content.push(
      table(
        ["Componente", "Tipo", "Qtd.", "Preço unit.", "Subtotal", "Req."],
        report.components.map((c) => [
          {
            stack: [
              { text: c.name, bold: true },
              ...(c.description ? [{ text: c.description, fontSize: 7.5, color: COLOR.muted }] : []),
            ],
          } as TableCell,
          cell(c.domain),
          cell(c.quantity),
          cell(formatCurrency(c.unitPrice)),
          cell(formatCurrency(c.subtotal), { bold: true }),
          cell(c.requirementCode),
        ]),
        ["*", 50, 30, 62, 66, 32],
        ["left", "left", "right", "right", "right", "left"]
      )
    )
    content.push({
      text: [{ text: "Custo dos componentes: ", color: COLOR.muted }, { text: formatCurrency(s.totalCost), bold: true }],
      alignment: "right",
      margin: [0, 0, 0, 8],
    })
  }

  if (sections.has("resources")) {
    content.push(heading(++n, "Recursos e orçamento"))
    content.push(
      table(
        ["Recurso", "Tipo", "Disponibilidade", "Cálculo", "Custo", "Req."],
        report.resources.map((r) => [
          {
            stack: [
              { text: r.name, bold: true },
              ...(r.description ? [{ text: r.description, fontSize: 7.5, color: COLOR.muted }] : []),
            ],
          } as TableCell,
          cell(r.type),
          cell(r.availability),
          cell(r.calculation),
          cell(formatCurrency(r.cost), { bold: true }),
          cell(r.requirementCode),
        ]),
        ["*", 64, 64, 100, 62, 30],
        ["left", "left", "left", "left", "right", "left"]
      )
    )
    content.push(
      table(
        ["Orçamento", "Valor"],
        [
          [cell("Componentes de hardware"), cell(formatCurrency(report.budget.componentsHardware))],
          [cell("Componentes de software"), cell(formatCurrency(report.budget.componentsSoftware))],
          [cell("Recursos já disponíveis (custo de uso)"), cell(formatCurrency(report.budget.resourcesAvailable))],
          [
            cell("Desembolso necessário (componentes + recursos a adquirir)"),
            cell(formatCurrency(report.budget.toSpend)),
          ],
          [
            cell("Orçamento total", { bold: true }),
            cell(formatCurrency(report.budget.total), { bold: true, color: COLOR.primary }),
          ],
        ],
        ["*", 110],
        ["left", "right"]
      )
    )
  }

  return {
    pageSize: "A4",
    // Margens de documento: 2 cm nas laterais, espaço para cabeçalho e rodapé.
    pageMargins: [56, 64, 56, 56],
    info: {
      title: `Relatório — ${report.project.name}`,
      author: "FlowBot",
      subject: REPORT_TYPE_LABELS[report.type],
      creator: "FlowBot",
    },
    header: (currentPage: number, _pageCount: number, pageSize: ContextPageSize) =>
      currentPage === 1
        ? null
        : ({
            margin: [56, 28, 56, 0],
            stack: [
              {
                columns: [
                  { text: report.project.name, fontSize: 8, color: COLOR.muted },
                  { text: "Relatório do projeto", fontSize: 8, color: COLOR.muted, alignment: "right" },
                ],
              },
              {
                canvas: [
                  { type: "line", x1: 0, y1: 4, x2: pageSize.width - 112, y2: 4, lineWidth: 0.4, lineColor: COLOR.line },
                ],
              },
            ],
          } as Content),
    footer: (currentPage: number, pageCount: number, pageSize: ContextPageSize) =>
      ({
        margin: [56, 14, 56, 0],
        stack: [
          {
            canvas: [
              { type: "line", x1: 0, y1: 0, x2: pageSize.width - 112, y2: 0, lineWidth: 0.4, lineColor: COLOR.line },
            ],
          },
          {
            columns: [
              { text: `Gerado pelo FlowBot em ${generated}`, fontSize: 7.5, color: COLOR.muted },
              { text: `Página ${currentPage} de ${pageCount}`, fontSize: 7.5, color: COLOR.muted, alignment: "right" },
            ],
            margin: [0, 5, 0, 0],
          },
        ],
      }) as Content,
    content,
    defaultStyle: { font: "Roboto", fontSize: 9, color: COLOR.text, lineHeight: 1.2 },
    styles: {
      title: { fontSize: 22, bold: true, margin: [0, 4, 0, 4] },
      lead: { fontSize: 10, color: COLOR.muted, margin: [0, 0, 0, 4] },
      h1: { fontSize: 13, bold: true, color: COLOR.primary, margin: [0, 14, 0, 0] },
      table: { fontSize: 8.5, margin: [0, 0, 0, 10] },
      tableHeader: { bold: true, fontSize: 8, color: "#334155" },
      muted: { fontSize: 8.5, color: COLOR.muted },
      notice: { fontSize: 9, color: COLOR.warning, margin: [0, 0, 0, 10] },
    },
  }
}

/** Gera o PDF no navegador e inicia o download. */
export async function downloadReportPdf(report: ProjectReport) {
  const [pdfMakeModule, fontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ])
  // Os dois arquivos são CommonJS: o conteúdo vem em `default` no import dinâmico.
  const pdfMake = (pdfMakeModule.default ?? pdfMakeModule) as typeof pdfMakeModule.default
  const fonts = (fontsModule.default ?? fontsModule) as typeof fontsModule.default
  pdfMake.addVirtualFileSystem(fonts)
  pdfMake.createPdf(buildDocument(report)).download(`${reportFileStem(report)}.pdf`)
}
