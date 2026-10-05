import { NextRequest } from "next/server";
import { authorizeProject } from "../../../../../lib/project-access";
import {
  ensureKanbanColumns,
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
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

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
