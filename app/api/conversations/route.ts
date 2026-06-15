import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { tursoDb } from "../../../lib/turso-db";

export async function GET(req: NextRequest) {
  // Verificar se o usuário está autenticado
  const user = await getCurrentUser();
  
  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Buscar todas as conversas do usuário
    const userChats = await tursoDb.chat.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          take: 1, // Pegar apenas a primeira mensagem para exibir no preview
        },
      },
    });

    // Transformar os dados para o formato esperado pelo componente
    const conversations = userChats.map(chat => ({
      id: chat.id,
      title: chat.title,
      date: chat.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      messages: chat.messages.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
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