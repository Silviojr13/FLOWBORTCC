import { tursoDb } from "./turso-db";
import { DEFAULT_KANBAN_COLUMNS, getSprintStatus } from "./kanban";

// Helpers de servidor do módulo Kanban, usados pelas rotas /api/projects/[id]/{kanban,columns,tasks,sprints}.

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(error: string, status: number) {
  return json({ error }, status);
}

export const MAX_COLUMNS = 8;

export function parseWipLimit(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return "invalid";
  return n;
}

export async function findOwnedProject(projectId: string, userId: string) {
  return tursoDb.project.findUnique({ where: { id: projectId, userId } });
}

// Garante que o projeto tenha colunas (RF05): cria as padrão na primeira visita ao Kanban.
export async function ensureKanbanColumns(projectId: string) {
  const existing = await tursoDb.kanbanColumn.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
  });
  if (existing.length > 0) return existing;

  await tursoDb.kanbanColumn.createMany({
    data: DEFAULT_KANBAN_COLUMNS.map((c, i) => ({
      name: c.name,
      isDone: c.isDone,
      order: i,
      projectId,
    })),
  });

  return tursoDb.kanbanColumn.findMany({ where: { projectId }, orderBy: { order: "asc" } });
}

// Campos relacionados que a UI precisa para renderizar um card sem consultas extras.
export const taskInclude = {
  requirement: { select: { id: true, code: true, description: true } },
  feature: { select: { id: true, name: true } },
  sprint: { select: { id: true, name: true } },
} as const;

export async function listTasks(projectId: string) {
  return tursoDb.task.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: taskInclude,
  });
}

// Lista sprints com progresso (UC13): total de tarefas e quantas estão em colunas concluídas.
export async function listSprintsWithProgress(projectId: string) {
  const sprints = await tursoDb.sprint.findMany({
    where: { projectId },
    orderBy: { startDate: "asc" },
    include: { tasks: { select: { column: { select: { isDone: true } } } } },
  });

  return sprints.map(({ tasks, ...sprint }) => ({
    ...sprint,
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((t) => t.column.isDone).length,
    status: getSprintStatus(sprint.startDate, sprint.endDate),
  }));
}

// Aceita "YYYY-MM-DD" ou ISO completo; devolve Date em UTC (data pura) ou null se inválido.
export function parseDateInput(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

// Valida que uma FK opcional (requisito, funcionalidade, sprint, coluna) pertence ao projeto.
export async function resolveProjectRef(
  model: "requirement" | "feature" | "sprint" | "kanbanColumn",
  id: unknown,
  projectId: string
): Promise<string | null | "invalid"> {
  if (id === null || id === undefined || id === "") return null;
  if (typeof id !== "string") return "invalid";

  let found: { id: string } | null = null;
  if (model === "requirement") {
    found = await tursoDb.requirement.findUnique({ where: { id, projectId }, select: { id: true } });
  } else if (model === "feature") {
    found = await tursoDb.feature.findUnique({ where: { id, projectId }, select: { id: true } });
  } else if (model === "sprint") {
    found = await tursoDb.sprint.findUnique({ where: { id, projectId }, select: { id: true } });
  } else {
    found = await tursoDb.kanbanColumn.findUnique({ where: { id, projectId }, select: { id: true } });
  }

  return found ? found.id : "invalid";
}
