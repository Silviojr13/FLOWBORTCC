import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { tursoDb } from "../../../../../../lib/turso-db";
import { isTaskPriority } from "../../../../../../lib/kanban";
import {
  findOwnedProject,
  json,
  jsonError,
  parseDateInput,
  resolveProjectRef,
  taskInclude,
} from "../../../../../../lib/kanban-server";

async function findOwnedTask(projectId: string, taskId: string, userId: string) {
  const project = await findOwnedProject(projectId, userId);
  if (!project) return null;
  return tursoDb.task.findUnique({
    where: { id: taskId, projectId },
    include: { column: { select: { id: true, name: true } } },
  });
}

// Edita a tarefa (UC05) e/ou move de coluna (RF07 "ação manual"); a mudança de coluna
// gera um registro em TaskHistory (RF09).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id: projectId, taskId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const existing = await findOwnedTask(projectId, taskId, user.id);
  if (!existing) return jsonError("Tarefa não encontrada", 404);

  const {
    title,
    description,
    priority,
    assignee,
    dueDate,
    columnId,
    order,
    requirementId,
    featureId,
    sprintId,
  } = await req.json();

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    return jsonError("Título da tarefa não pode ficar vazio", 400);
  }
  if (priority !== undefined && !isTaskPriority(priority)) {
    return jsonError("Prioridade deve ser uma de: Alta, Média, Baixa", 400);
  }
  if (order !== undefined && (!Number.isInteger(order) || order < 0)) {
    return jsonError("Ordem inválida", 400);
  }

  let due: Date | null | undefined;
  if (dueDate !== undefined) {
    const parsed = parseDateInput(dueDate);
    if (parsed === "invalid") return jsonError("Prazo inválido", 400);
    due = parsed;
  }

  let reqId: string | null | undefined;
  if (requirementId !== undefined) {
    const r = await resolveProjectRef("requirement", requirementId, projectId);
    if (r === "invalid") return jsonError("Requisito vinculado não encontrado neste projeto", 400);
    reqId = r;
  }
  let featId: string | null | undefined;
  if (featureId !== undefined) {
    const r = await resolveProjectRef("feature", featureId, projectId);
    if (r === "invalid") return jsonError("Funcionalidade vinculada não encontrada neste projeto", 400);
    featId = r;
  }
  let sprId: string | null | undefined;
  if (sprintId !== undefined) {
    const r = await resolveProjectRef("sprint", sprintId, projectId);
    if (r === "invalid") return jsonError("Sprint vinculada não encontrada neste projeto", 400);
    sprId = r;
  }

  let targetColumn: { id: string; name: string } | null = null;
  if (columnId !== undefined && columnId !== existing.columnId) {
    if (typeof columnId !== "string") return jsonError("Coluna inválida", 400);
    targetColumn = await tursoDb.kanbanColumn.findUnique({
      where: { id: columnId, projectId },
      select: { id: true, name: true },
    });
    if (!targetColumn) return jsonError("Coluna não encontrada neste projeto", 400);
  }

  try {
    let nextOrder: number | undefined = order;
    if (targetColumn && nextOrder === undefined) {
      const last = await tursoDb.task.findFirst({
        where: { columnId: targetColumn.id },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      nextOrder = (last?.order ?? -1) + 1;
    }

    const task = await tursoDb.task.update({
      where: { id: taskId },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        description:
          description !== undefined
            ? typeof description === "string"
              ? description.trim() || null
              : null
            : undefined,
        priority,
        assignee:
          assignee !== undefined
            ? typeof assignee === "string"
              ? assignee.trim() || null
              : null
            : undefined,
        dueDate: due,
        order: nextOrder,
        columnId: targetColumn?.id,
        requirementId: reqId,
        featureId: featId,
        sprintId: sprId,
        history: targetColumn
          ? { create: { fromColumn: existing.column.name, toColumn: targetColumn.name } }
          : undefined,
      },
      include: taskInclude,
    });

    return json({ task });
  } catch (error) {
    console.error("Erro ao atualizar tarefa:", error);
    return jsonError("Erro ao atualizar tarefa", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id: projectId, taskId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const existing = await findOwnedTask(projectId, taskId, user.id);
  if (!existing) return jsonError("Tarefa não encontrada", 404);

  try {
    await tursoDb.task.delete({ where: { id: taskId } });
    return json({ message: "Tarefa excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir tarefa:", error);
    return jsonError("Erro ao excluir tarefa", 500);
  }
}
