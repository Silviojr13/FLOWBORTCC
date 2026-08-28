import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { tursoDb } from "../../../../../../lib/turso-db";

const VALID_STATUSES = ["Planejada", "Em desenvolvimento", "Concluída"];

async function findOwnedFeature(projectId: string, featureId: string, userId: string) {
  const feature = await tursoDb.feature.findUnique({
    where: { id: featureId, projectId },
    include: { project: true },
  });

  if (!feature || feature.project.userId !== userId) {
    return null;
  }

  return feature;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> }
) {
  const { id: projectId, featureId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const existing = await findOwnedFeature(projectId, featureId, user.id);
  if (!existing) {
    return new Response(
      JSON.stringify({ error: "Funcionalidade não encontrada" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const { name, description, status, requirementId } = await req.json();

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return new Response(
      JSON.stringify({ error: "Nome da funcionalidade não pode ficar vazio" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return new Response(
      JSON.stringify({ error: `Status deve ser um de: ${VALID_STATUSES.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let linkedRequirementId: string | null | undefined;
  if (requirementId !== undefined) {
    if (requirementId === null) {
      linkedRequirementId = null;
    } else {
      const requirement = await tursoDb.requirement.findUnique({
        where: { id: requirementId, projectId },
      });
      if (!requirement) {
        return new Response(
          JSON.stringify({ error: "Requisito vinculado não encontrado neste projeto" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      linkedRequirementId = requirement.id;
    }
  }

  try {
    const feature = await tursoDb.feature.update({
      where: { id: featureId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? (typeof description === "string" ? description.trim() || null : null) : undefined,
        status,
        requirementId: linkedRequirementId,
      },
    });

    return new Response(JSON.stringify({ feature }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao atualizar funcionalidade:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao atualizar funcionalidade" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> }
) {
  const { id: projectId, featureId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const existing = await findOwnedFeature(projectId, featureId, user.id);
  if (!existing) {
    return new Response(
      JSON.stringify({ error: "Funcionalidade não encontrada" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await tursoDb.feature.delete({ where: { id: featureId } });

    return new Response(JSON.stringify({ message: "Funcionalidade excluída com sucesso" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao excluir funcionalidade:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao excluir funcionalidade" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
