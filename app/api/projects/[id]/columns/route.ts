import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import { tursoDb } from "../../../../../lib/turso-db";
import {
  MAX_COLUMNS,
  ensureKanbanColumns,
  findOwnedProject,
  json,
  jsonError,
  parseWipLimit,
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
    const columns = await ensureKanbanColumns(projectId);
    return json({ columns });
  } catch (error) {
    console.error("Erro ao buscar colunas:", error);
    return jsonError("Erro ao buscar colunas", 500);
  }
}

// Cria uma coluna nova no fim do quadro (RF05).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const project = await findOwnedProject(projectId, user.id);
  if (!project) return jsonError("Projeto não encontrado", 404);

  const { name, isDone, wipLimit } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return jsonError("Nome da coluna é obrigatório", 400);
  }

  const limit = parseWipLimit(wipLimit);
  if (limit === "invalid") {
    return jsonError("Limite WIP deve ser um número inteiro maior ou igual a 1", 400);
  }

  try {
    const columns = await ensureKanbanColumns(projectId);
    if (columns.length >= MAX_COLUMNS) {
      return jsonError(`O quadro suporta no máximo ${MAX_COLUMNS} colunas`, 400);
    }

    const column = await tursoDb.kanbanColumn.create({
      data: {
        name: name.trim(),
        isDone: isDone === true,
        wipLimit: limit,
        order: columns.length,
        projectId,
      },
    });

    return json({ column }, 201);
  } catch (error) {
    console.error("Erro ao criar coluna:", error);
    return jsonError("Erro ao criar coluna", 500);
  }
}

// Reordena as colunas do quadro: body { columnIds: [...] } na ordem desejada.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError("Usuário não autenticado", 401);

  const project = await findOwnedProject(projectId, user.id);
  if (!project) return jsonError("Projeto não encontrado", 404);

  const { columnIds } = await req.json();
  if (!Array.isArray(columnIds) || columnIds.some((id) => typeof id !== "string")) {
    return jsonError("columnIds deve ser uma lista de ids", 400);
  }

  try {
    const columns = await tursoDb.kanbanColumn.findMany({ where: { projectId }, select: { id: true } });
    const known = new Set(columns.map((c) => c.id));
    const unique = new Set(columnIds);
    if (unique.size !== columnIds.length || columnIds.length !== known.size || columnIds.some((id) => !known.has(id))) {
      return jsonError("A lista deve conter exatamente as colunas do projeto", 400);
    }

    await tursoDb.$transaction(
      columnIds.map((id: string, order: number) =>
        tursoDb.kanbanColumn.update({ where: { id }, data: { order } })
      )
    );

    const updated = await tursoDb.kanbanColumn.findMany({ where: { projectId }, orderBy: { order: "asc" } });
    return json({ columns: updated });
  } catch (error) {
    console.error("Erro ao reordenar colunas:", error);
    return jsonError("Erro ao reordenar colunas", 500);
  }
}
