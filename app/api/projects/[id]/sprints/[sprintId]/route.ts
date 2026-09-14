import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { tursoDb } from "../../../../../../lib/turso-db";
import { getSprintStatus } from "../../../../../../lib/kanban";
import {
  findOwnedProject,
  json,
  jsonError,
  parseDateInput,
  taskInclude,
} from "../../../../../../lib/kanban-server";

async function findOwnedSprint(projectId: string, sprintId: string, userId: string) {
  const project = await findOwnedProject(projectId, userId);
  if (!project) return null;
  return tursoDb.sprint.findUnique({ where: { id: sprintId, projectId } });
}

// Detalhe da sprint com suas tarefas e progresso (UC13): geral e por responsável.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  const { id: projectId, sprintId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const sprint = await findOwnedSprint(projectId, sprintId, user.id);
  if (!sprint) return jsonError("Sprint não encontrada", 404);

  try {
    const tasks = await tursoDb.task.findMany({
      where: { sprintId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: { ...taskInclude, column: { select: { id: true, name: true, isDone: true } } },
    });

    const byAssignee: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      const key = t.assignee ?? "Sem responsável";
      byAssignee[key] ??= { total: 0, done: 0 };
      byAssignee[key].total++;
      if (t.column.isDone) byAssignee[key].done++;
    }

    return json({
      sprint: {
        ...sprint,
        tasksTotal: tasks.length,
        tasksDone: tasks.filter((t) => t.column.isDone).length,
        status: getSprintStatus(sprint.startDate, sprint.endDate),
      },
      tasks,
      byAssignee,
    });
  } catch (error) {
    console.error("Erro ao buscar sprint:", error);
    return jsonError("Erro ao buscar sprint", 500);
  }
}

// Edita a sprint. Se `taskIds` vier no body, substitui o conjunto de tarefas da sprint.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  const { id: projectId, sprintId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const existing = await findOwnedSprint(projectId, sprintId, user.id);
  if (!existing) return jsonError("Sprint não encontrada", 404);

  const { name, goal, startDate, endDate, taskIds } = await req.json();

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return jsonError("Nome da sprint não pode ficar vazio", 400);
  }

  let start: Date | undefined;
  if (startDate !== undefined) {
    const parsed = parseDateInput(startDate);
    if (!parsed || parsed === "invalid") return jsonError("Data de início inválida", 400);
    start = parsed;
  }
  let end: Date | undefined;
  if (endDate !== undefined) {
    const parsed = parseDateInput(endDate);
    if (!parsed || parsed === "invalid") return jsonError("Data de término inválida", 400);
    end = parsed;
  }
  const effectiveStart = start ?? existing.startDate;
  const effectiveEnd = end ?? existing.endDate;
  if (effectiveEnd.getTime() < effectiveStart.getTime()) {
    return jsonError("A data de término deve ser igual ou posterior à de início", 400);
  }

  if (taskIds !== undefined) {
    if (!Array.isArray(taskIds) || taskIds.length === 0 || taskIds.some((id) => typeof id !== "string")) {
      return jsonError("Selecione ao menos uma tarefa para compor a sprint", 400);
    }
    const count = await tursoDb.task.count({ where: { id: { in: taskIds }, projectId } });
    if (count !== new Set(taskIds).size) {
      return jsonError("Alguma tarefa selecionada não pertence a este projeto", 400);
    }
  }

  try {
    const sprint = await tursoDb.$transaction(async (tx) => {
      const updated = await tx.sprint.update({
        where: { id: sprintId },
        data: {
          name: name !== undefined ? name.trim() : undefined,
          goal: goal !== undefined ? (typeof goal === "string" ? goal.trim() || null : null) : undefined,
          startDate: start,
          endDate: end,
        },
      });
      if (taskIds !== undefined) {
        await tx.task.updateMany({ where: { sprintId, id: { notIn: taskIds } }, data: { sprintId: null } });
        await tx.task.updateMany({ where: { id: { in: taskIds } }, data: { sprintId } });
      }
      return updated;
    });

    const tasks = await tursoDb.task.findMany({
      where: { sprintId },
      select: { column: { select: { isDone: true } } },
    });

    return json({
      sprint: {
        ...sprint,
        tasksTotal: tasks.length,
        tasksDone: tasks.filter((t) => t.column.isDone).length,
        status: getSprintStatus(sprint.startDate, sprint.endDate),
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar sprint:", error);
    return jsonError("Erro ao atualizar sprint", 500);
  }
}

// Exclui a sprint; as tarefas voltam ao backlog geral (sprintId = null, via onDelete SetNull).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  const { id: projectId, sprintId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const existing = await findOwnedSprint(projectId, sprintId, user.id);
  if (!existing) return jsonError("Sprint não encontrada", 404);

  try {
    await tursoDb.sprint.delete({ where: { id: sprintId } });
    return json({ message: "Sprint excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir sprint:", error);
    return jsonError("Erro ao excluir sprint", 500);
  }
}
