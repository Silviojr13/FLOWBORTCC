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
    const projects = await tursoDb.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { requirements: true, tasks: true, components: true } },
      },
    });

    return new Response(JSON.stringify({ projects }), {
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

  const { name, description } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return new Response(
      JSON.stringify({ error: "Nome do projeto é obrigatório" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const project = await tursoDb.project.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        userId: user.id,
      },
    });

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
