import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { tursoDb } from "../../../lib/turso-db";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const [projects, memberships] = await Promise.all([
      tursoDb.project.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { requirements: true, tasks: true, components: true, studies: true } },
        },
      }),
      tursoDb.projectMember.findMany({
        where: { userId: user.id },
        orderBy: { project: { updatedAt: "desc" } },
        select: {
          role: true,
          canSeeCosts: true,
          project: {
            include: {
              _count: { select: { requirements: true, tasks: true, components: true, studies: true } },
              user: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    // Projetos de outras pessoas em que esta é membro, com o cargo e o nome do dono.
    const shared = memberships.map(({ role, canSeeCosts, project: { user: owner, ...project } }) => ({
      ...project,
      role,
      canSeeCosts,
      ownerName: owner.name,
    }));

    return new Response(JSON.stringify({ projects, shared }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar projetos:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar projetos" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const { name, description, origin, chatId } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return new Response(
      JSON.stringify({ error: "Nome do projeto é obrigatório" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const resolvedOrigin = origin === "ia" ? "ia" : "manual";

  try {
    const project = await tursoDb.project.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        origin: resolvedOrigin,
        userId: user.id,
      },
    });

    // Vincula ao projeto a conversa que originou os requisitos (Modo A do assistente),
    // para que o histórico fique acessível pelo assistente flutuante dentro do projeto.
    if (typeof chatId === "string" && chatId) {
      await tursoDb.chat.updateMany({
        where: { id: chatId, userId: user.id },
        data: { projectId: project.id },
      });
    }

    return new Response(JSON.stringify({ project }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao criar projeto:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar projeto" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
