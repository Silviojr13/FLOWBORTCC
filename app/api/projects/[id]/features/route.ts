import { NextRequest } from "next/server";
import { authorizeProject } from "../../../../../lib/project-access";
import { tursoDb } from "../../../../../lib/turso-db";

const VALID_STATUSES = ["Planejada", "Em desenvolvimento", "Concluída"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

  try {
    const features = await tursoDb.feature.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    return new Response(JSON.stringify({ features }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar funcionalidades:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar funcionalidades" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { edit: "funcionalidades" });
  if (gate instanceof Response) return gate;

  const { name, description, status, requirementId } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return new Response(
      JSON.stringify({ error: "Nome da funcionalidade é obrigatório" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const resolvedStatus = status && VALID_STATUSES.includes(status) ? status : "Planejada";

  let linkedRequirementId: string | null = null;
  if (requirementId) {
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

  try {
    const feature = await tursoDb.feature.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        status: resolvedStatus,
        projectId,
        requirementId: linkedRequirementId,
      },
    });

    return new Response(JSON.stringify({ feature }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao criar funcionalidade:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar funcionalidade" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
