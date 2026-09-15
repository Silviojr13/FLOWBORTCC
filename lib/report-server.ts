import { tursoDb } from "./turso-db";
import { getSprintStatus, isTaskOverdue } from "./kanban";
import { REPORT_SECTIONS, type ProjectReport, type ReportType } from "./report";

export interface ReportOptions {
  type: ReportType;
  from: Date | null;
  to: Date | null;
}

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function inPeriod(date: Date | null, from: Date | null, to: Date | null) {
  if (!date) return false;
  const t = date.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

// Consolida requisitos, tarefas, sprints, funcionalidades e componentes do projeto (UC11).
// Período: filtra tarefas pelo prazo (ou pela data de criação, se não houver prazo) e
// sprints que intersectam o intervalo. Requisitos e componentes não têm dimensão temporal.
export async function buildProjectReport(
  project: {
    id: string;
    name: string;
    description: string | null;
    startDate: Date | null;
    endDate: Date | null;
    createdAt: Date;
  },
  options: ReportOptions
): Promise<ProjectReport> {
  const projectId = project.id;
  const { from, to } = options;
  const hasPeriod = from !== null || to !== null;

  const [requirements, features, columns, allTasks, allSprints, components] = await Promise.all([
    tursoDb.requirement.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
    tursoDb.feature.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    tursoDb.kanbanColumn.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    tursoDb.task.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "asc" }],
      include: {
        column: { select: { name: true, isDone: true, order: true } },
        requirement: { select: { code: true } },
        feature: { select: { id: true, name: true } },
        sprint: { select: { name: true } },
      },
    }),
    tursoDb.sprint.findMany({ where: { projectId }, orderBy: { startDate: "asc" } }),
    tursoDb.hardwareComponent.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { requirement: { select: { code: true } } },
    }),
  ]);

  const tasks = hasPeriod
    ? allTasks.filter((t) => inPeriod(t.dueDate ?? t.createdAt, from, to))
    : allTasks;

  const sprints = hasPeriod
    ? allSprints.filter((s) => {
        if (from && s.endDate.getTime() < from.getTime()) return false;
        if (to && s.startDate.getTime() > to.getTime()) return false;
        return true;
      })
    : allSprints;

  const taskIds = new Set(tasks.map((t) => t.id));
  const tasksDone = tasks.filter((t) => t.column.isDone);

  // Cobertura de requisitos (RF02/RF14) considera todas as tarefas, não só as do período.
  const coverage = new Map<string, { total: number; done: number }>();
  for (const t of allTasks) {
    if (!t.requirementId) continue;
    const entry = coverage.get(t.requirementId) ?? { total: 0, done: 0 };
    entry.total++;
    if (t.column.isDone) entry.done++;
    coverage.set(t.requirementId, entry);
  }

  const requirementsByCategory: Record<string, number> = {};
  const requirementsByStatus: Record<string, number> = {};
  for (const r of requirements) {
    requirementsByCategory[r.category] = (requirementsByCategory[r.category] ?? 0) + 1;
    requirementsByStatus[r.status] = (requirementsByStatus[r.status] ?? 0) + 1;
  }
  const uncovered = requirements.filter((r) => !coverage.has(r.id));

  // Progresso por módulo (RF13): módulo = funcionalidade. Tarefas sem funcionalidade
  // entram em "Sem funcionalidade".
  const moduleMap = new Map<string, { name: string; tasksTotal: number; tasksDone: number }>();
  for (const f of features) moduleMap.set(f.id, { name: f.name, tasksTotal: 0, tasksDone: 0 });
  const noModule = { name: "Sem funcionalidade", tasksTotal: 0, tasksDone: 0 };
  for (const t of tasks) {
    const entry = t.featureId ? moduleMap.get(t.featureId) ?? noModule : noModule;
    entry.tasksTotal++;
    if (t.column.isDone) entry.tasksDone++;
  }
  const modules = [...moduleMap.values(), ...(noModule.tasksTotal > 0 ? [noModule] : [])].map((m) => ({
    ...m,
    pct: pct(m.tasksDone, m.tasksTotal),
  }));

  const sprintRows = sprints.map((s) => {
    const sprintTasks = allTasks.filter((t) => t.sprintId === s.id);
    const done = sprintTasks.filter((t) => t.column.isDone).length;
    return {
      id: s.id,
      name: s.name,
      goal: s.goal,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate.toISOString(),
      status: getSprintStatus(s.startDate, s.endDate),
      tasksTotal: sprintTasks.length,
      tasksDone: done,
      pct: pct(done, sprintTasks.length),
    };
  });

  const totalCost = components.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);

  const sortedTasks = [...tasks].sort(
    (a, b) => a.column.order - b.column.order || a.order - b.order
  );

  return {
    generatedAt: new Date().toISOString(),
    type: options.type,
    period: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    hasDataInPeriod: !hasPeriod || tasks.length > 0 || sprints.length > 0,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      startDate: project.startDate?.toISOString() ?? null,
      endDate: project.endDate?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
    },
    summary: {
      requirementsTotal: requirements.length,
      requirementsByCategory,
      requirementsByStatus,
      requirementsUncovered: uncovered.length,
      featuresTotal: features.length,
      tasksTotal: tasks.length,
      tasksDone: tasksDone.length,
      tasksOverdue: tasks.filter((t) => isTaskOverdue({ dueDate: t.dueDate?.toISOString() ?? null }, t.column.isDone)).length,
      progressPct: pct(tasksDone.length, tasks.length),
      sprintsTotal: sprints.length,
      componentsTotal: components.length,
      totalCost,
    },
    sprints: sprintRows,
    modules,
    columns: columns.map((c) => ({
      name: c.name,
      isDone: c.isDone,
      count: tasks.filter((t) => t.columnId === c.id).length,
    })),
    requirements: requirements.map((r) => ({
      code: r.code,
      description: r.description,
      category: r.category,
      priority: r.priority,
      status: r.status,
      level: r.level,
      tasksTotal: coverage.get(r.id)?.total ?? 0,
      tasksDone: coverage.get(r.id)?.done ?? 0,
    })),
    uncoveredRequirements: uncovered.map((r) => ({ code: r.code, description: r.description })),
    tasks: sortedTasks
      .filter((t) => taskIds.has(t.id))
      .map((t) => ({
        title: t.title,
        column: t.column.name,
        isDone: t.column.isDone,
        priority: t.priority,
        assignee: t.assignee,
        dueDate: t.dueDate?.toISOString() ?? null,
        overdue: isTaskOverdue({ dueDate: t.dueDate?.toISOString() ?? null }, t.column.isDone),
        requirementCode: t.requirement?.code ?? null,
        featureName: t.feature?.name ?? null,
        sprintName: t.sprint?.name ?? null,
      })),
    components: components.map((c) => ({
      name: c.name,
      description: c.description,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      subtotal: c.quantity * c.unitPrice,
      requirementCode: c.requirement?.code ?? null,
    })),
  };
}

export function reportHasSection(report: ProjectReport, section: (typeof REPORT_SECTIONS)[ReportType][number]) {
  return REPORT_SECTIONS[report.type].includes(section);
}
