import { tursoDb } from "./turso-db";
import { formatDate, isTaskOverdue } from "./kanban";

// Monta um resumo textual do estado atual do projeto para ser injetado no prompt do
// assistente. É o que permite ao FlowBot responder sobre "este projeto" em vez de falar
// genericamente sobre robótica.
export async function buildProjectContext(projectId: string, userId: string): Promise<string | null> {
  const project = await tursoDb.project.findUnique({
    where: { id: projectId, userId },
    select: { id: true, name: true, description: true, startDate: true, endDate: true },
  });
  if (!project) return null;

  const [requirements, features, components, columns, tasks, sprints] = await Promise.all([
    tursoDb.requirement.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
    tursoDb.feature.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    tursoDb.hardwareComponent.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { requirement: { select: { code: true } } },
    }),
    tursoDb.kanbanColumn.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    tursoDb.task.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }],
      include: {
        column: { select: { name: true, isDone: true } },
        requirement: { select: { code: true } },
        feature: { select: { name: true } },
        sprint: { select: { name: true } },
      },
    }),
    tursoDb.sprint.findMany({ where: { projectId }, orderBy: { startDate: "asc" } }),
  ]);

  const totalCost = components.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);
  const tasksDone = tasks.filter((t) => t.column.isDone).length;
  const overdue = tasks.filter((t) =>
    isTaskOverdue({ dueDate: t.dueDate?.toISOString() ?? null }, t.column.isDone)
  ).length;
  const covered = new Set(tasks.map((t) => t.requirementId).filter(Boolean));
  const uncovered = requirements.filter((r) => !covered.has(r.id)).map((r) => r.code);

  const lines: string[] = [];
  lines.push(`Projeto: "${project.name}"`);
  if (project.description) lines.push(`Descricao: ${project.description}`);
  if (project.startDate || project.endDate) {
    lines.push(`Cronograma: ${formatDate(project.startDate)} a ${formatDate(project.endDate)}`);
  }
  lines.push(
    `Resumo: ${requirements.length} requisito(s), ${features.length} funcionalidade(s), ${tasks.length} tarefa(s) (${tasksDone} concluidas, ${overdue} atrasadas), ${sprints.length} sprint(s), ${components.length} componente(s), custo estimado R$ ${totalCost.toFixed(2)}.`
  );
  if (uncovered.length > 0) {
    lines.push(`Requisitos sem tarefa vinculada: ${uncovered.join(", ")}.`);
  }

  lines.push("");
  lines.push("REQUISITOS:");
  if (requirements.length === 0) {
    lines.push("- (nenhum cadastrado)");
  } else {
    for (const r of requirements) {
      lines.push(
        `- ${r.code} [${r.category}, prioridade ${r.priority}, status ${r.status}${r.level ? `, nivel ${r.level}` : ""}]: ${r.description}`
      );
    }
  }

  lines.push("");
  lines.push("FUNCIONALIDADES:");
  if (features.length === 0) {
    lines.push("- (nenhuma cadastrada)");
  } else {
    for (const f of features) {
      lines.push(`- ${f.name} [${f.status}]${f.description ? `: ${f.description}` : ""}`);
    }
  }

  lines.push("");
  lines.push(`COLUNAS DO KANBAN: ${columns.map((c) => c.name).join(" | ") || "(nenhuma)"}`);
  lines.push("TAREFAS:");
  if (tasks.length === 0) {
    lines.push("- (nenhuma cadastrada)");
  } else {
    for (const t of tasks) {
      const meta = [
        t.column.name,
        `prioridade ${t.priority}`,
        t.assignee ? `responsavel ${t.assignee}` : null,
        t.dueDate ? `prazo ${formatDate(t.dueDate)}` : null,
        t.requirement?.code ?? null,
        t.feature ? `func. ${t.feature.name}` : null,
        t.sprint ? `sprint ${t.sprint.name}` : null,
      ].filter(Boolean);
      lines.push(`- "${t.title}" [${meta.join(", ")}]`);
    }
  }

  lines.push("");
  lines.push("SPRINTS:");
  if (sprints.length === 0) {
    lines.push("- (nenhuma planejada)");
  } else {
    for (const s of sprints) {
      const count = tasks.filter((t) => t.sprintId === s.id).length;
      lines.push(
        `- "${s.name}" (${formatDate(s.startDate)} a ${formatDate(s.endDate)}), ${count} tarefa(s)${s.goal ? `, objetivo: ${s.goal}` : ""}`
      );
    }
  }

  lines.push("");
  lines.push("COMPONENTES:");
  if (components.length === 0) {
    lines.push("- (nenhum cadastrado)");
  } else {
    for (const c of components) {
      lines.push(
        `- ${c.name} x${c.quantity} a R$ ${c.unitPrice.toFixed(2)}${c.requirement ? ` (${c.requirement.code})` : ""}`
      );
    }
  }

  return lines.join("\n");
}
