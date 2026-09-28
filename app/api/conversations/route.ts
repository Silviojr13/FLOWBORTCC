import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { tursoDb } from "../../../lib/turso-db";

// Lista as conversas do usuário. `?projectId=<id>` restringe às conversas de um projeto
// (usado pelo assistente flutuante); `?projectId=none` traz apenas as conversas avulsas.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const projectId = req.nextUrl.searchParams.get("projectId");

  try {
    const userChats = await tursoDb.chat.findMany({
      where: {
        userId: user.id,
        ...(projectId === "none"
          ? { projectId: null }
          : projectId
            ? { projectId }
            : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 1 },
        _count: { select: { messages: true } },
      },
    });

    const conversations = userChats.map((chat: (typeof userChats)[number]) => ({
      id: chat.id,
      title: chat.title,
      projectId: chat.projectId,
      messageCount: chat._count.messages,
      date: chat.updatedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      updatedAt: chat.updatedAt,
      preview: chat.messages[0]?.content ?? "",
    }));

    return new Response(JSON.stringify({ conversations }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar conversas:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar conversas" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
