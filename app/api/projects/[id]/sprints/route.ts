import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import { tursoDb } from "../../../../../lib/turso-db";
import { getSprintStatus } from "../../../../../lib/kanban";
import {
  findOwnedProject,
  json,
  jsonError,
  listSprintsWithProgress,
  parseDateInput,
} from "../../../../../lib/kanban-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const project = await findOwnedProject(projectId, user.id);
  if (!project) return jsonError("Projeto não encontrado", 404);

  try {
    const sprints = await listSprintsWithProgress(projectId);
    return json({ sprints });
  } catch (error) {
    console.error("Erro ao buscar sprints:", error);
    return jsonError("Erro ao buscar sprints", 500);
  }
}

// Planeja uma sprint (RF08 / UC07): período, objetivo e conjunto de tarefas.
// Exceção do UC07: sem ao menos uma tarefa selecionada, o planejamento não é registrado.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const project = await findOwnedProject(projectId, user.id);
  if (!project) return jsonError("Projeto não encontrado", 404);

  const { name, goal, startDate, endDate, taskIds } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return jsonError("Nome da sprint é obrigatório", 400);
  }

  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || start === "invalid") return jsonError("Data de início é obrigatória", 400);
  if (!end || end === "invalid") return jsonError("Data de término é obrigatória", 400);
  if (end.getTime() < start.getTime()) {
    return jsonError("A data de término deve ser igual ou posterior à de início", 400);
  }

  if (!Array.isArray(taskIds) || taskIds.length === 0 || taskIds.some((id) => typeof id !== "string")) {
    return jsonError("Selecione ao menos uma tarefa para compor a sprint", 400);
  }

  const tasks = await tursoDb.task.findMany({
    where: { id: { in: taskIds }, projectId },
    select: { id: true },
  });
  if (tasks.length !== new Set(taskIds).size) {
    return jsonError("Alguma tarefa selecionada não pertence a este projeto", 400);
  }

  try {
    const sprint = await tursoDb.$transaction(async (tx) => {
      const created = await tx.sprint.create({
        data: {
          name: name.trim(),
          goal: typeof goal === "string" ? goal.trim() || null : null,
          startDate: start,
          endDate: end,
          projectId,
        },
      });
      await tx.task.updateMany({
        where: { id: { in: taskIds } },
        data: { sprintId: created.id },
      });
      return created;
    });

    return json(
      {
        sprint: {
          ...sprint,
          tasksTotal: tasks.length,
          tasksDone: 0,
          status: getSprintStatus(sprint.startDate, sprint.endDate),
        },
      },
      201
    );
  } catch (error) {
    console.error("Erro ao criar sprint:", error);
    return jsonError("Erro ao criar sprint", 500);
  }
}
