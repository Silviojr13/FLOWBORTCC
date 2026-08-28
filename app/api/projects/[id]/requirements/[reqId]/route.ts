import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { tursoDb } from "../../../../../../lib/turso-db";

const VALID_CATEGORIES = ["Funcional", "Não Funcional"];
const VALID_PRIORITIES = ["Alta", "Média", "Baixa"];
const VALID_STATUSES = ["Em Aberto", "Validado", "Descartado"];

async function findOwnedRequirement(projectId: string, reqId: string, userId: string) {
  const requirement = await tursoDb.requirement.findUnique({
    where: { id: reqId, projectId },
    include: { project: true },
  });

  if (!requirement || requirement.project.userId !== userId) {
    return null;
  }

  return requirement;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const { id: projectId, reqId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const existing = await findOwnedRequirement(projectId, reqId, user.id);
  if (!existing) {
    return new Response(
      JSON.stringify({ error: "Requisito não encontrado" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const { description, category, priority, status, level } = await req.json();

  if (description !== undefined && (typeof description !== "string" || !description.trim())) {
    return new Response(
      JSON.stringify({ error: "Descrição do requisito não pode ficar vazia" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    return new Response(
      JSON.stringify({ error: `Categoria deve ser uma de: ${VALID_CATEGORIES.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    return new Response(
      JSON.stringify({ error: `Prioridade deve ser uma de: ${VALID_PRIORITIES.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return new Response(
      JSON.stringify({ error: `Status deve ser um de: ${VALID_STATUSES.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Guarda o estado anterior no histórico antes de aplicar a alteração (RF03 / RNF04).
    await tursoDb.requirementHistory.create({
      data: {
        requirementId: existing.id,
        description: existing.description,
        category: existing.category,
        priority: existing.priority,
        status: existing.status,
        level: existing.level,
      },
    });

    const requirement = await tursoDb.requirement.update({
      where: { id: reqId },
      data: {
        description: description !== undefined ? description.trim() : undefined,
        category,
        priority,
        status,
        level: level !== undefined ? (typeof level === "string" && level.trim() ? level.trim() : null) : undefined,
      },
    });

    return new Response(JSON.stringify({ requirement }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao atualizar requisito:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao atualizar requisito" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const { id: projectId, reqId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const existing = await findOwnedRequirement(projectId, reqId, user.id);
  if (!existing) {
    return new Response(
      JSON.stringify({ error: "Requisito não encontrado" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await tursoDb.requirement.delete({ where: { id: reqId } });

    return new Response(JSON.stringify({ message: "Requisito excluído com sucesso" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao excluir requisito:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao excluir requisito" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
