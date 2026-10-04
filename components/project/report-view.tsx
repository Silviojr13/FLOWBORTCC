"use client"

import { HELP, HelpLabel } from "@/components/help-tooltip"
import {
  REPORT_SECTIONS,
  REPORT_TYPE_LABELS,
  formatCurrency,
  formatReportDate,
  formatReportDateTime,
  formatTaskTeam,
  filtersLabel,
  periodLabel,
  type ProjectReport,
} from "@/lib/report"
import { cn } from "@/lib/utils"

function Section({
  title,
  children,
}: {
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="report-section flex flex-col gap-3 break-inside-avoid">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function ReportTable({
  headers,
  rows,
  emptyMessage = "Nenhum registro.",
  align = [],
}: {
  headers: React.ReactNode[]
  rows: React.ReactNode[][]
  emptyMessage?: string
  align?: ("left" | "right" | "center")[]
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="report-table w-full text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "px-3 py-2 text-left font-medium",
                  align[i] === "right" && "text-right",
                  align[i] === "center" && "text-center"
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className="border-t border-border align-top">
              {cells.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-3 py-2",
                    align[i] === "right" && "text-right tabular-nums",
                    align[i] === "center" && "text-center"
                  )}
                >
                  {cell ?? <span className="text-muted-foreground">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Progress({ pct }: { pct: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="tabular-nums">{pct}%</span>
    </span>
  )
}

function Stat({ label, value, hint, tone }: { label: React.ReactNode; value: React.ReactNode; hint?: string; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-xl font-semibold",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// Renderização do relatório consolidado (RF13). Usada na tela do dashboard e na rota de
// impressão (PDF pelo navegador).
export function ReportView({ report }: { report: ProjectReport }) {
  const sections = new Set(REPORT_SECTIONS[report.type])
  const s = report.summary

  return (
    <article className="report-root flex flex-col gap-8">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Relatório do projeto</p>
        <h1 className="text-2xl font-semibold text-foreground">{report.project.name}</h1>
        {report.project.description && (
          <p className="text-sm text-muted-foreground">{report.project.description}</p>
        )}
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="inline font-medium">Tipo: </dt>
            <dd className="inline">{REPORT_TYPE_LABELS[report.type]}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Período: </dt>
            <dd className="inline">{periodLabel(report.period)}</dd>
          </div>
          {(report.project.startDate || report.project.endDate) && (
            <div>
              <dt className="inline font-medium">Cronograma: </dt>
              <dd className="inline">
                {formatReportDate(report.project.startDate)} – {formatReportDate(report.project.endDate)}
              </dd>
            </div>
          )}
          <div>
            <dt className="inline font-medium">Gerado em: </dt>
            <dd className="inline">{formatReportDateTime(report.generatedAt)}</dd>
          </div>
          {filtersLabel(report.filters) && (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="inline font-medium">Filtros: </dt>
              <dd className="inline">{filtersLabel(report.filters)}</dd>
            </div>
          )}
        </dl>
      </header>

      {!report.hasDataInPeriod && (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Não há tarefas nem sprints no período selecionado. Ajuste o período ou gere o relatório
          de todo o projeto.
        </p>
      )}

      {sections.has("summary") && (
        <Section title="Resumo">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Requisitos"
              value={s.requirementsTotal}
              hint={`${s.requirementsByCategory["Funcional"] ?? 0} RF · ${s.requirementsByCategory["Não Funcional"] ?? 0} RNF`}
            />
            <Stat
              label="Requisitos sem cobertura"
              value={s.requirementsUncovered}
              tone={s.requirementsUncovered > 0 ? "warning" : undefined}
              hint="sem tarefa vinculada"
            />
            <Stat
              label="Tarefas"
              value={s.tasksTotal}
              hint={`${s.tasksDone} concluída(s) · ${s.featuresTotal} funcionalidade(s)`}
            />
            <Stat label="Progresso" value={`${s.progressPct}%`} hint="tarefas concluídas" />
            <Stat label="Tarefas em atraso" value={s.tasksOverdue} tone={s.tasksOverdue > 0 ? "danger" : undefined} />
            <Stat label="Sprints" value={s.sprintsTotal} />
            <Stat
              label="Componentes e recursos"
              value={`${s.componentsTotal} · ${s.resourcesTotal}`}
              hint={`${formatCurrency(s.totalCost)} · ${formatCurrency(s.resourcesCost)}`}
            />
            <Stat
              label={
                <HelpLabel label="Custo estimado" content={HELP.estimatedCost}>
                  Orçamento total
                </HelpLabel>
              }
              value={formatCurrency(s.budgetTotal)}
              hint={`desembolso: ${formatCurrency(report.budget.toSpend)}`}
            />
          </div>
          {Object.keys(s.requirementsByStatus).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Status dos requisitos:{" "}
              {Object.entries(s.requirementsByStatus)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </p>
          )}
        </Section>
      )}

      {sections.has("sprints") && (
        <Section title="Progresso por sprint">
          <ReportTable
            headers={["Sprint", "Período", "Status", "Tarefas", "Concluídas", "Progresso"]}
            align={["left", "left", "left", "right", "right", "left"]}
            emptyMessage="Nenhuma sprint ainda."
            rows={report.sprints.map((sp) => [
              <span key="n">
                <span className="font-medium">{sp.name}</span>
                {sp.goal && <span className="block text-xs text-muted-foreground">{sp.goal}</span>}
              </span>,
              `${formatReportDate(sp.startDate)} – ${formatReportDate(sp.endDate)}`,
              sp.status,
              sp.tasksTotal,
              sp.tasksDone,
              <Progress key="p" pct={sp.pct} />,
            ])}
          />
        </Section>
      )}

      {sections.has("modules") && (
        <Section title="Progresso por módulo (funcionalidade)">
          <ReportTable
            headers={["Módulo", "Tarefas", "Concluídas", "Progresso"]}
            align={["left", "right", "right", "left"]}
            emptyMessage="Nenhuma funcionalidade ainda."
            rows={report.modules.map((m) => [
              m.name,
              m.tasksTotal,
              m.tasksDone,
              <Progress key="p" pct={m.pct} />,
            ])}
          />
        </Section>
      )}

      {sections.has("columns") && (
        <Section title="Tarefas por coluna do Kanban">
          <div className="flex flex-wrap gap-2">
            {report.columns.map((c) => (
              <span
                key={c.name}
                className={cn(
                  "rounded-full border border-border px-3 py-1 text-sm",
                  c.isDone && "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                )}
              >
                {c.name}: <span className="font-medium">{c.count}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {sections.has("requirements") && (
        <Section
          title={
            <HelpLabel label="Rastreabilidade" content={HELP.traceability}>
              Requisitos e rastreabilidade
            </HelpLabel>
          }
        >
          <ReportTable
            headers={[
              "Código",
              "Descrição",
              <HelpLabel key="categoria" label="Categoria" content={HELP.category}>
                Categoria
              </HelpLabel>,
              "Prioridade",
              "Status",
              <HelpLabel key="nivel" label="Nível" content={HELP.requirementLevel}>
                Nível
              </HelpLabel>,
              "Tarefas",
            ]}
            align={["left", "left", "left", "left", "left", "left", "center"]}
            emptyMessage="Nenhum requisito ainda."
            rows={report.requirements.map((r) => [
              <span key="c" className="font-mono text-xs">{r.code}</span>,
              r.description,
              r.category,
              r.priority,
              r.status,
              r.level,
              <span key="t" className={cn("tabular-nums", r.tasksTotal === 0 && "text-amber-600 dark:text-amber-400")}>
                {r.tasksDone}/{r.tasksTotal}
              </span>,
            ])}
          />
          {report.uncoveredRequirements.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Requisitos sem cobertura ({report.uncoveredRequirements.length})
              </p>
              <ul className="mt-1 list-inside list-disc text-amber-900/90 dark:text-amber-200/90">
                {report.uncoveredRequirements.map((r) => (
                  <li key={r.code}>
                    <span className="font-mono text-xs">{r.code}</span> — {r.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {sections.has("tasks") && (
        <Section title="Tarefas">
          <ReportTable
            headers={["Tarefa", "Coluna", "Prioridade", "Responsável", "Prazo", "Requisito", "Funcionalidade", "Sprint"]}
            emptyMessage="Nenhuma tarefa no período."
            rows={report.tasks.map((t) => [
              <span key="t" className={cn(t.isDone && "text-muted-foreground line-through")}>{t.title}</span>,
              t.column,
              t.priority,
              formatTaskTeam(t),
              t.dueDate ? (
                <span key="d" className={cn(t.overdue && "font-medium text-destructive")}>
                  {formatReportDate(t.dueDate)}
                  {t.overdue && " (atrasada)"}
                </span>
              ) : null,
              t.requirementCode ? <span key="r" className="font-mono text-xs">{t.requirementCode}</span> : null,
              t.featureName,
              t.sprintName,
            ])}
          />
        </Section>
      )}

      {sections.has("components") && (
        <Section title="Componentes">
          <ReportTable
            headers={["Componente", "Tipo", "Descrição", "Qtd.", "Preço unit.", "Subtotal", "Requisito"]}
            align={["left", "left", "left", "right", "right", "right", "left"]}
            emptyMessage="Nenhum componente ainda."
            rows={report.components.map((c) => [
              c.name,
              c.domain,
              c.description,
              c.quantity,
              formatCurrency(c.unitPrice),
              formatCurrency(c.subtotal),
              c.requirementCode ? <span key="r" className="font-mono text-xs">{c.requirementCode}</span> : null,
            ])}
          />
          <p className="text-right text-sm">
            <span className="text-muted-foreground">Custo dos componentes: </span>
            <span className="text-lg font-semibold">{formatCurrency(s.totalCost)}</span>
          </p>
        </Section>
      )}

      {sections.has("resources") && (
        <Section title="Recursos e orçamento">
          <ReportTable
            headers={["Recurso", "Tipo", "Disponibilidade", "Cálculo", "Custo", "Requisito"]}
            align={["left", "left", "left", "left", "right", "left"]}
            emptyMessage="Nenhum recurso cadastrado."
            rows={report.resources.map((r) => [
              <span key="n">
                <span className="font-medium">{r.name}</span>
                {r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}
              </span>,
              r.type,
              r.availability,
              r.calculation,
              formatCurrency(r.cost),
              r.requirementCode ? <span key="r" className="font-mono text-xs">{r.requirementCode}</span> : null,
            ])}
          />
          <ReportTable
            headers={["Orçamento", "Valor"]}
            align={["left", "right"]}
            rows={[
              ["Componentes de hardware", formatCurrency(report.budget.componentsHardware)],
              ["Componentes de software", formatCurrency(report.budget.componentsSoftware)],
              ["Recursos já disponíveis (custo de uso)", formatCurrency(report.budget.resourcesAvailable)],
              ["Desembolso necessário (componentes + recursos a adquirir)", formatCurrency(report.budget.toSpend)],
              [<span key="t" className="font-semibold">Orçamento total</span>, <span key="v" className="font-semibold">{formatCurrency(report.budget.total)}</span>],
            ]}
          />
        </Section>
      )}

      <footer className="border-t border-border pt-3 text-xs text-muted-foreground">
        Gerado pelo FlowBot em {formatReportDateTime(report.generatedAt)}.
      </footer>
    </article>
  )
}
