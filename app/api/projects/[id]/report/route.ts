import { NextRequest } from "next/server";
import { authorizeProject } from "../../../../../lib/project-access";
import { tursoDb } from "../../../../../lib/turso-db";
import { json, jsonError, parseDateInput } from "../../../../../lib/kanban-server";
import { buildProjectReport } from "../../../../../lib/report-server";
import {
  isCsvTable,
  isReportType,
  reportFileStem,
  reportTableToCsv,
  reportToMarkdown,
} from "../../../../../lib/report";

// Relatório consolidado do projeto (RF13 / UC11) com exportação (RF15).
// Query: type=completo|progresso|requisitos|custos, from=YYYY-MM-DD, to=YYYY-MM-DD,
//        sprint=<id>|none, assignee=<nome>|none, feature=<id>|none,
//        format=json|md|csv, table=tasks|requirements|components|sprints (só para csv).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;
  const project = await tursoDb.project.findUnique({ where: { id: projectId } });
  if (!project) return jsonError("Projeto não encontrado", 404);

  const q = req.nextUrl.searchParams;

  const typeParam = q.get("type") ?? "completo";
  if (!isReportType(typeParam)) {
    return jsonError("Tipo de relatório inválido (completo, progresso, requisitos ou custos)", 400);
  }
  const hideCosts = !gate.access.canSeeCosts;
  if (hideCosts && typeParam === "custos") {
    return jsonError("Seu cargo neste projeto não permite ver custos.", 403);
  }

  const from = parseDateInput(q.get("from"));
  const to = parseDateInput(q.get("to"));
  if (from === "invalid") return jsonError("Data inicial inválida", 400);
  if (to === "invalid") return jsonError("Data final inválida", 400);
  if (from && to && to.getTime() < from.getTime()) {
    return jsonError("A data final deve ser igual ou posterior à inicial", 400);
  }

  const format = q.get("format") ?? "json";
  const table = q.get("table") ?? "tasks";
  if (!["json", "md", "csv"].includes(format)) {
    return jsonError("Formato inválido (json, md ou csv)", 400);
  }
  if (format === "csv" && !isCsvTable(table)) {
    return jsonError("Tabela inválida (tasks, requirements, components, resources ou sprints)", 400);
  }
  if (hideCosts && format === "csv" && (table === "components" || table === "resources")) {
    return jsonError("Seu cargo neste projeto não permite ver custos.", 403);
  }

  try {
    const report = await buildProjectReport(project, {
      type: typeParam,
      hideCosts,
      from,
      to,
      filters: {
        sprint: q.get("sprint") ?? "",
        assignee: q.get("assignee") ?? "",
        feature: q.get("feature") ?? "",
      },
    });

    if (format === "md") {
      return new Response(reportToMarkdown(report), {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${reportFileStem(report)}.md"`,
        },
      });
    }

    if (format === "csv" && isCsvTable(table)) {
      return new Response(reportTableToCsv(report, table), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${reportFileStem(report)}-${table}.csv"`,
        },
      });
    }

    return json({ report });
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    return jsonError("Erro ao gerar relatório", 500);
  }
}
