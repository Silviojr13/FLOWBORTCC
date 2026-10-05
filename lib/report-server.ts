import { tursoDb } from "./turso-db";
import { getSprintStatus, isTaskOverdue } from "./kanban";
import {
  REPORT_FILTER_NONE,
  REPORT_SECTIONS,
  type ProjectReport,
  type ReportFilters,
  type ReportType,
} from "./report";
import {
  RESOURCE_AVAILABILITY_LABELS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  buildBudget,
  describeResourceCost,
  isResourceAvailability,
  isResourceType,
  resourceCost,
} from "./resources";

export interface ReportOptions {
  type: ReportType;
  from: Date | null;
  to: Date | null;
  /** Sprint, responsável e funcionalidade: "" = todos; REPORT_FILTER_NONE = sem vínculo. */
  filters?: Partial<ReportFilters>;
  /** Para quem não vê custos: sem preços, recursos nem orçamento. */
  hideCosts?: boolean;
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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

// Consolida requisitos, tarefas, sprints, funcionalidades, componentes e recursos (UC11).
// Período: filtra tarefas pelo prazo (ou pela data de criação, se não houver prazo) e
// sprints que intersectam o intervalo. Sprint, responsável e funcionalidade filtram as
// tarefas (e, no caso da sprint, a tabela de sprints). Requisitos, componentes e recursos
// não têm dimensão temporal.
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
  const sprintFilter = options.filters?.sprint ?? "";
  const assigneeFilter = options.filters?.assignee ?? "";
  const featureFilter = options.filters?.feature ?? "";
  const hasFilters = Boolean(sprintFilter || assigneeFilter || featureFilter);

  const [requirements, features, columns, allTasks, allSprints, componentRows, resourceRows] = await Promise.all([
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
        participants: { select: { name: true }, orderBy: { order: "asc" } },
      },
    }),
    tursoDb.sprint.findMany({ where: { projectId }, orderBy: { startDate: "asc" } }),
    tursoDb.hardwareComponent.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { requirement: { select: { code: true } } },
    }),
    tursoDb.resource.findMany({
      where: { projectId },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
      include: { requirement: { select: { code: true } } },
    }),
  ]);

  // Filtrar por uma pessoa traz as tarefas em que ela é a responsável principal ou participa.
  const peopleOf = (t: { assignee: string | null; participants: { name: string }[] }) =>
    [t.assignee, ...t.participants.map((p) => p.name)].filter((name): name is string => Boolean(name));
  const matchesAssignee = (t: { assignee: string | null; participants: { name: string }[] }) =>
    !assigneeFilter ||
    (assigneeFilter === REPORT_FILTER_NONE ? !t.assignee : peopleOf(t).includes(assigneeFilter));
  const matchesFeature = (featureId: string | null) =>
    !featureFilter ||
    (featureFilter === REPORT_FILTER_NONE ? featureId === null : featureId === featureFilter);
  const matchesSprint = (sprintId: string | null) =>
    !sprintFilter ||
    (sprintFilter === REPORT_FILTER_NONE ? sprintId === null : sprintId === sprintFilter);

  const tasks = allTasks.filter(
    (t) =>
      (!hasPeriod || inPeriod(t.dueDate ?? t.createdAt, from, to)) &&
      matchesSprint(t.sprintId) &&
      matchesAssignee(t) &&
      matchesFeature(t.featureId)
  );

  const sprints = allSprints.filter((s) => {
    if (sprintFilter === REPORT_FILTER_NONE) return false;
    if (sprintFilter && s.id !== sprintFilter) return false;
    if (from && s.endDate.getTime() < from.getTime()) return false;
    if (to && s.startDate.getTime() > to.getTime()) return false;
    return true;
  });

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
    // Responsável e funcionalidade também recortam o progresso de cada sprint.
    const sprintTasks = allTasks.filter(
      (t) => t.sprintId === s.id && matchesAssignee(t) && matchesFeature(t.featureId)
    );
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

  // Sem custos, os valores não saem do servidor: preços zerados e nenhum recurso.
  const hideCosts = options.hideCosts === true;
  const components = hideCosts ? componentRows.map((c) => ({ ...c, unitPrice: 0 })) : componentRows;
  const resources = hideCosts ? [] : resourceRows;

  const totalCost = components.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);
  const budget = buildBudget(components, resources);
  const resourcesCost = resources.reduce((sum, r) => sum + resourceCost(r), 0);

  const typeOrder: readonly string[] = RESOURCE_TYPES;
  const featureName = (id: string) => features.find((f) => f.id === id)?.name ?? null;
  const sprintName = (id: string) => allSprints.find((s) => s.id === id)?.name ?? null;

  const sortedTasks = [...tasks].sort(
    (a, b) => a.column.order - b.column.order || a.order - b.order
  );

  return {
    generatedAt: new Date().toISOString(),
    type: options.type,
    period: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    filters: {
      sprint: !sprintFilter ? null : sprintFilter === REPORT_FILTER_NONE ? "Sem sprint" : sprintName(sprintFilter),
      assignee: !assigneeFilter ? null : assigneeFilter === REPORT_FILTER_NONE ? "Sem responsável" : assigneeFilter,
      feature: !featureFilter ? null : featureFilter === REPORT_FILTER_NONE ? "Sem funcionalidade" : featureName(featureFilter),
    },
    filterOptions: {
      sprints: allSprints.map((s) => ({ id: s.id, name: s.name })),
      assignees: [...new Set(allTasks.flatMap(peopleOf))].sort(
        (a, b) => a.localeCompare(b, "pt-BR")
      ),
      features: features.map((f) => ({ id: f.id, name: f.name })),
    },
    hasDataInPeriod: (!hasPeriod && !hasFilters) || tasks.length > 0 || sprints.length > 0,
    costsHidden: hideCosts,
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
      resourcesTotal: resources.length,
      resourcesCost,
      budgetTotal: budget.total,
    },
    budget,
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
        participants: t.participants.map((p) => p.name),
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
      domain: c.domain === "Software" ? "Software" : "Hardware",
      requirementCode: c.requirement?.code ?? null,
    })),
    // Mesma ordem da aba Recursos: pessoas, equipamentos, software, espaços, outros.
    resources: [...resources]
      .sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type))
      .map((r) => ({
      name: r.name,
      description: r.description,
      type: isResourceType(r.type) ? RESOURCE_TYPE_LABELS[r.type] : r.type,
      availability: isResourceAvailability(r.availability)
        ? RESOURCE_AVAILABILITY_LABELS[r.availability]
        : r.availability,
      calculation: describeResourceCost(r, (v) => money.format(v)),
      cost: resourceCost(r),
      requirementCode: r.requirement?.code ?? null,
    })),
  };
}

export function reportHasSection(report: ProjectReport, section: (typeof REPORT_SECTIONS)[ReportType][number]) {
  return REPORT_SECTIONS[report.type].includes(section);
}
