import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { authorizeProject, publicPermissions } from "../../../../lib/project-access";
import { tursoDb } from "../../../../lib/turso-db";

// GET: o projeto e o acesso de quem pede (cargo e permissões), que a interface usa para
// esconder o que a pessoa não pode fazer. O bloqueio de verdade fica em cada rota.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;
  const access = publicPermissions(gate.access);

  try {
    const project = await tursoDb.project.findUnique({
      where: { id: projectId },
      include: {
        requirements: { orderBy: { code: "asc" } },
        user: { select: { name: true } },
      },
    });

    if (!project) {
      return new Response(
        JSON.stringify({ error: "Projeto não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const { user: owner, ...rest } = project;
    return new Response(JSON.stringify({ project: { ...rest, ownerName: owner.name }, access }), {
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
