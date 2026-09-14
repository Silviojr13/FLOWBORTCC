import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { tursoDb } from "../../../../../../lib/turso-db";
import { findOwnedProject, json, jsonError } from "../../../../../../lib/kanban-server";

// Drag-and-drop (RF07): body { columnId, taskIds } define a ordem final das tarefas dessa
// coluna. Tarefas vindas de outra coluna são movidas e ganham registro no histórico (RF09).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const project = await findOwnedProject(projectId, user.id);
  if (!project) return jsonError("Projeto não encontrado", 404);

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
    select: { id: true, name: true },
  });
  if (!column) return jsonError("Coluna não encontrada neste projeto", 400);

  const tasks = await tursoDb.task.findMany({
    where: { id: { in: taskIds }, projectId },
    include: { column: { select: { name: true } } },
  });
  if (tasks.length !== taskIds.length) {
    return jsonError("Alguma tarefa não pertence a este projeto", 400);
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

    return json({ message: "Ordem atualizada" });
  } catch (error) {
    console.error("Erro ao reordenar tarefas:", error);
    return jsonError("Erro ao reordenar tarefas", 500);
  }
}
