import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { tursoDb } from "../../../../lib/turso-db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;

  // Verificar se o usuário está autenticado
  const user = await getCurrentUser();
  
  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Buscar a conversa específica
    const chat = await tursoDb.chat.findUnique({
      where: {
        id: chatId,
        userId: user.id, // Garantir que o usuário só veja suas próprias conversas
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!chat) {
      return new Response(
        JSON.stringify({ error: "Conversa não encontrada" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ chat }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar conversa:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar conversa" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;

  // Verificar se o usuário está autenticado
  const user = await getCurrentUser();
  
  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Verificar se a conversa pertence ao usuário
    const chat = await tursoDb.chat.findUnique({
      where: {
        id: chatId,
        userId: user.id,
      },
    });

    if (!chat) {
      return new Response(
        JSON.stringify({ error: "Conversa não encontrada" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Deletar a conversa e todas as mensagens associadas
    await tursoDb.chat.delete({
      where: {
        id: chatId,
        userId: user.id,
      },
    });

    return new Response(JSON.stringify({ message: "Conversa deletada com sucesso" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao deletar conversa:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao deletar conversa" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}