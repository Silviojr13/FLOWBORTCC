import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import { tursoDb } from "../../../../../lib/turso-db";
import { isTaskPriority } from "../../../../../lib/kanban";
import {
  ensureKanbanColumns,
  findOwnedProject,
  json,
  jsonError,
  listTasks,
  parseDateInput,
  resolveProjectRef,
  taskInclude,
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
    const tasks = await listTasks(projectId);
    return json({ tasks });
  } catch (error) {
    console.error("Erro ao buscar tarefas:", error);
    return jsonError("Erro ao buscar tarefas", 500);
  }
}

// Cria uma tarefa (RF06 / UC05). Sem `columnId`, entra na primeira coluna do quadro.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const project = await findOwnedProject(projectId, user.id);
  if (!project) return jsonError("Projeto não encontrado", 404);

  const {
    title,
    description,
    priority,
    assignee,
    dueDate,
    columnId,
    requirementId,
    featureId,
    sprintId,
  } = await req.json();

  if (!title || typeof title !== "string" || !title.trim()) {
    return jsonError("Título da tarefa é obrigatório", 400);
  }

  const resolvedPriority = priority === undefined ? "Média" : priority;
  if (!isTaskPriority(resolvedPriority)) {
    return jsonError("Prioridade deve ser uma de: Alta, Média, Baixa", 400);
  }

  const due = parseDateInput(dueDate);
  if (due === "invalid") return jsonError("Prazo inválido", 400);

  const [reqId, featId, sprId] = await Promise.all([
    resolveProjectRef("requirement", requirementId, projectId),
    resolveProjectRef("feature", featureId, projectId),
    resolveProjectRef("sprint", sprintId, projectId),
  ]);
  if (reqId === "invalid") return jsonError("Requisito vinculado não encontrado neste projeto", 400);
  if (featId === "invalid") return jsonError("Funcionalidade vinculada não encontrada neste projeto", 400);
  if (sprId === "invalid") return jsonError("Sprint vinculada não encontrada neste projeto", 400);

  try {
    const columns = await ensureKanbanColumns(projectId);
    const column = columnId
      ? columns.find((c) => c.id === columnId)
      : columns[0];
    if (!column) return jsonError("Coluna não encontrada neste projeto", 400);

    const last = await tursoDb.task.findFirst({
      where: { columnId: column.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const task = await tursoDb.task.create({
      data: {
        title: title.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        priority: resolvedPriority,
        assignee: typeof assignee === "string" ? assignee.trim() || null : null,
        dueDate: due,
        order: (last?.order ?? -1) + 1,
        columnId: column.id,
        projectId,
        requirementId: reqId,
        featureId: featId,
        sprintId: sprId,
        // Primeira entrada do histórico: a coluna em que a tarefa nasceu (RF09).
        history: { create: { fromColumn: null, toColumn: column.name } },
      },
      include: taskInclude,
    });

    return json({ task }, 201);
  } catch (error) {
    console.error("Erro ao criar tarefa:", error);
    return jsonError("Erro ao criar tarefa", 500);
  }
}
