import { NextRequest } from "next/server";
import { authorizeProject } from "../../../../../../lib/project-access";
import { tursoDb } from "../../../../../../lib/turso-db";
import { emitProjectEvent } from "../../../../../../lib/project-events";
import { isTaskPriority } from "../../../../../../lib/kanban";
import {
  json,
  jsonError,
  MAX_TASK_PARTICIPANTS,
  normalizeTaskTeam,
  parseDateInput,
  parseParticipants,
  participantsWrite,
  resolveProjectRef,
  taskInclude,
} from "../../../../../../lib/kanban-server";

async function findProjectTask(projectId: string, taskId: string) {
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
  const gate = await authorizeProject(projectId, { edit: "kanban" });
  if (gate instanceof Response) return gate;

  const existing = await findProjectTask(projectId, taskId);
  if (!existing) return jsonError("Tarefa não encontrada", 404);

  const {
    title,
    description,
    priority,
    assignee,
    participants,
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

  // Mudar o responsável ou os participantes recalcula a equipe inteira, partindo do que a
  // tarefa já tem para o campo que não veio no pedido.
  const participantList = parseParticipants(participants);
  if (participantList === "invalid") return jsonError("Participantes devem ser uma lista de nomes", 400);
  let team: { assignee: string | null; participants: string[] } | undefined;
  if (assignee !== undefined || participantList !== undefined) {
    const current =
      participantList ??
      (
        await tursoDb.taskParticipant.findMany({
          where: { taskId },
          orderBy: { order: "asc" },
          select: { name: true },
        })
      ).map((p) => p.name);
    const normalized = normalizeTaskTeam(assignee !== undefined ? assignee : existing.assignee, current);
    if (normalized === "too-many") {
      return jsonError(`Uma tarefa pode ter no máximo ${MAX_TASK_PARTICIPANTS} participantes além do responsável`, 400);
    }
    team = normalized;
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
        assignee: team?.assignee,
        participants: team ? participantsWrite(team.participants) : undefined,
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

    // Mover para uma coluna concluída pode fechar a cobertura de um requisito.
    let effects: Awaited<ReturnType<typeof emitProjectEvent>> = [];
    if (targetColumn) {
      const column = await tursoDb.kanbanColumn.findUnique({
        where: { id: targetColumn.id },
        select: { isDone: true },
      });
      effects = await emitProjectEvent({
        type: "task.moved",
        projectId,
        taskId: task.id,
        taskTitle: task.title,
        requirementId: task.requirementId,
        toColumnIsDone: column?.isDone ?? false,
      });
    }

    return json({ task, effects });
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
  const gate = await authorizeProject(projectId, { edit: "kanban" });
  if (gate instanceof Response) return gate;

  const existing = await findProjectTask(projectId, taskId);
  if (!existing) return jsonError("Tarefa não encontrada", 404);

  try {
    await tursoDb.task.delete({ where: { id: taskId } });
    return json({ message: "Tarefa excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir tarefa:", error);
    return jsonError("Erro ao excluir tarefa", 500);
  }
}
