import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import { tursoDb } from "../../../../../lib/turso-db";

// Definir o tipo para a mensagem
interface Message {
  role: string;
  content: string;
}

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
    // Buscar todas as mensagens da conversa específica
    const messages = await tursoDb.message.findMany({
      where: {
        chatId: chatId,
        chat: {
          userId: user.id, // Garantir que o usuário só veja suas próprias conversas
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Transformar os dados para o formato esperado pelo componente
    const formattedMessages = messages.map((msg: typeof messages[number]) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    return new Response(JSON.stringify({ messages: formattedMessages }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar mensagens da conversa:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar mensagens da conversa" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}