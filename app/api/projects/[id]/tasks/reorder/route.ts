import { NextRequest } from "next/server";
import { authorizeProject } from "../../../../../../lib/project-access";
import { isOwnTask } from "../../../../../../lib/project-permissions";
import { tursoDb } from "../../../../../../lib/turso-db";
import { json, jsonError } from "../../../../../../lib/kanban-server";
import { emitProjectEvent, type ProjectEffect } from "../../../../../../lib/project-events";

// Drag-and-drop (RF07): body { columnId, taskIds } define a ordem final das tarefas dessa
// coluna. Tarefas vindas de outra coluna são movidas e ganham registro no histórico (RF09).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { edit: "kanban" });
  if (gate instanceof Response) return gate;

  const { columnId, taskIds } = await req.json();

  if (typeof columnId !== "string") return jsonError("Coluna inválida", 400);
  if (!Array.isArray(taskIds) || taskIds.some((id) => typeof id !== "string")) {
    return jsonError("taskIds deve ser uma lista de ids", 400);
  }
  if (new Set(taskIds).size !== taskIds.length) {
    return jsonError("taskIds contém ids repetidos", 400);
  }

  const column = await tursoDb.kanbanColumn.findUnique({
    where: { id: columnId, projectId },
    select: { id: true, name: true, isDone: true },
  });
  if (!column) return jsonError("Coluna não encontrada neste projeto", 400);

  const tasks = await tursoDb.task.findMany({
    where: { id: { in: taskIds }, projectId },
    include: { column: { select: { name: true } }, participants: { select: { name: true } } },
  });
  if (tasks.length !== taskIds.length) {
    return jsonError("Alguma tarefa não pertence a este projeto", 400);
  }
  // Estagiário: só move de coluna as tarefas em que é responsável ou participante.
  if (
    gate.access.ownTasksOnly &&
    tasks.some((t) => t.columnId !== column.id && !isOwnTask(gate.access.viewerName, t))
  ) {
    return jsonError("Seu cargo só permite mover as tarefas em que você é responsável ou participante.", 403);
  }

  try {
    const byId = new Map(tasks.map((t) => [t.id, t]));

    await tursoDb.$transaction(async (tx) => {
      for (const [order, id] of (taskIds as string[]).entries()) {
        const task = byId.get(id)!;
        const moved = task.columnId !== column.id;
        await tx.task.update({
          where: { id },
          data: {
            order,
            columnId: column.id,
            history: moved
              ? { create: { fromColumn: task.column.name, toColumn: column.name } }
              : undefined,
          },
        });
      }
    });

    // Publica as tarefas que realmente trocaram de coluna, para os outros módulos reagirem.
    const moved = (taskIds as string[]).filter((id) => byId.get(id)!.columnId !== column.id);
    const effects: ProjectEffect[] = [];
    for (const id of moved) {
      const task = byId.get(id)!;
      effects.push(
        ...(await emitProjectEvent({
          type: "task.moved",
          projectId,
          taskId: task.id,
          taskTitle: task.title,
          requirementId: task.requirementId,
          toColumnIsDone: column.isDone,
        }))
      );
    }

    return json({ message: "Ordem atualizada", effects });
  } catch (error) {
    console.error("Erro ao reordenar tarefas:", error);
    return jsonError("Erro ao reordenar tarefas", 500);
  }
}
