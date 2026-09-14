import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../../../lib/auth";
import { tursoDb } from "../../../../../../../lib/turso-db";
import { findOwnedProject, json, jsonError } from "../../../../../../../lib/kanban-server";

// Histórico de movimentação da tarefa entre colunas (RF09).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id: projectId, taskId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const project = await findOwnedProject(projectId, user.id);
  if (!project) return jsonError("Projeto não encontrado", 404);

  const task = await tursoDb.task.findUnique({ where: { id: taskId, projectId }, select: { id: true } });
  if (!task) return jsonError("Tarefa não encontrada", 404);

  try {
    const history = await tursoDb.taskHistory.findMany({
      where: { taskId },
      orderBy: { changedAt: "desc" },
    });
    return json({ history });
  } catch (error) {
    console.error("Erro ao buscar histórico da tarefa:", error);
    return jsonError("Erro ao buscar histórico da tarefa", 500);
  }
}
