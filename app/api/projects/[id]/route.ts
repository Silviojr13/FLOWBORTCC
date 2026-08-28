import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { tursoDb } from "../../../../lib/turso-db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const project = await tursoDb.project.findUnique({
      where: { id: projectId, userId: user.id },
      include: {
        requirements: { orderBy: { code: "asc" } },
      },
    });

    if (!project) {
      return new Response(
        JSON.stringify({ error: "Projeto não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ project }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar projeto:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar projeto" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const project = await tursoDb.project.findUnique({
      where: { id: projectId, userId: user.id },
    });

    if (!project) {
      return new Response(
        JSON.stringify({ error: "Projeto não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    await tursoDb.project.delete({ where: { id: projectId, userId: user.id } });

    return new Response(JSON.stringify({ message: "Projeto excluído com sucesso" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao excluir projeto:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao excluir projeto" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
