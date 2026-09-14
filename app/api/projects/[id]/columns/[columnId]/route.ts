import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { tursoDb } from "../../../../../../lib/turso-db";
import {
  findOwnedProject,
  json,
  jsonError,
  parseWipLimit,
} from "../../../../../../lib/kanban-server";

// Renomeia / marca como concluída / define limite WIP de uma coluna (RF05).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  const { id: projectId, columnId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const project = await findOwnedProject(projectId, user.id);
  if (!project) return jsonError("Projeto não encontrado", 404);

  const existing = await tursoDb.kanbanColumn.findUnique({ where: { id: columnId, projectId } });
  if (!existing) return jsonError("Coluna não encontrada", 404);

  const { name, isDone, wipLimit } = await req.json();

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return jsonError("Nome da coluna não pode ficar vazio", 400);
  }
  if (isDone !== undefined && typeof isDone !== "boolean") {
    return jsonError("isDone deve ser verdadeiro ou falso", 400);
  }

  let limit: number | null | undefined;
  if (wipLimit !== undefined) {
    const parsed = parseWipLimit(wipLimit);
    if (parsed === "invalid") {
      return jsonError("Limite WIP deve ser um número inteiro maior ou igual a 1", 400);
    }
    limit = parsed;
  }

  try {
    const column = await tursoDb.kanbanColumn.update({
      where: { id: columnId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        isDone,
        wipLimit: limit,
      },
    });

    return json({ column });
  } catch (error) {
    console.error("Erro ao atualizar coluna:", error);
    return jsonError("Erro ao atualizar coluna", 500);
  }
}

// Exclui uma coluna. Se houver tarefas nela, exige `?moveTo=<columnId>` para realocá-las
// (a movimentação entra no histórico das tarefas, RF09).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  const { id: projectId, columnId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const project = await findOwnedProject(projectId, user.id);
  if (!project) return jsonError("Projeto não encontrado", 404);

  const existing = await tursoDb.kanbanColumn.findUnique({
    where: { id: columnId, projectId },
    include: { tasks: { select: { id: true } } },
  });
  if (!existing) return jsonError("Coluna não encontrada", 404);

  const totalColumns = await tursoDb.kanbanColumn.count({ where: { projectId } });
  if (totalColumns <= 1) {
    return jsonError("O quadro precisa ter ao menos uma coluna", 400);
  }

  const moveTo = req.nextUrl.searchParams.get("moveTo");
  let target: { id: string; name: string } | null = null;

  if (existing.tasks.length > 0) {
    if (!moveTo) {
      return jsonError(
        `A coluna tem ${existing.tasks.length} tarefa(s). Escolha para qual coluna movê-las antes de excluir.`,
        400
      );
    }
    if (moveTo === columnId) {
      return jsonError("A coluna de destino deve ser diferente da excluída", 400);
    }
    target = await tursoDb.kanbanColumn.findUnique({
      where: { id: moveTo, projectId },
      select: { id: true, name: true },
    });
    if (!target) return jsonError("Coluna de destino não encontrada", 400);
  }

  try {
    await tursoDb.$transaction(async (tx) => {
      if (target && existing.tasks.length > 0) {
        await tx.task.updateMany({
          where: { columnId },
          data: { columnId: target.id },
        });
        await tx.taskHistory.createMany({
          data: existing.tasks.map((t) => ({
            taskId: t.id,
            fromColumn: existing.name,
            toColumn: target!.name,
          })),
        });
      }
      await tx.kanbanColumn.delete({ where: { id: columnId } });

      // Fecha o buraco na ordenação.
      const remaining = await tx.kanbanColumn.findMany({
        where: { projectId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      for (const [order, c] of remaining.entries()) {
        await tx.kanbanColumn.update({ where: { id: c.id }, data: { order } });
      }
    });

    return json({ message: "Coluna excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir coluna:", error);
    return jsonError("Erro ao excluir coluna", 500);
  }
}
