import { NextRequest } from "next/server";
import { authorizeProject } from "../../../../../../../lib/project-access";
import { tursoDb } from "../../../../../../../lib/turso-db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const { id: projectId, reqId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

  const requirement = await tursoDb.requirement.findUnique({
    where: { id: reqId, projectId },
    select: { id: true },
  });

  if (!requirement) {
    return new Response(
      JSON.stringify({ error: "Requisito não encontrado" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const history = await tursoDb.requirementHistory.findMany({
      where: { requirementId: reqId },
      orderBy: { changedAt: "desc" },
    });

    return new Response(JSON.stringify({ history }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar histórico do requisito:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar histórico do requisito" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
