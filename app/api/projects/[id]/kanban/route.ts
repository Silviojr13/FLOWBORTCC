import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import {
  ensureKanbanColumns,
  findOwnedProject,
  json,
  jsonError,
  listSprintsWithProgress,
  listTasks,
} from "../../../../../lib/kanban-server";

// Carga completa do quadro (UC06): colunas, tarefas e sprints do projeto em uma chamada.
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
    const [columns, tasks, sprints] = await Promise.all([
      ensureKanbanColumns(projectId),
      listTasks(projectId),
      listSprintsWithProgress(projectId),
    ]);

    return json({ columns, tasks, sprints });
  } catch (error) {
    console.error("Erro ao carregar Kanban:", error);
    return jsonError("Erro ao carregar Kanban", 500);
  }
}
