import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import { tursoDb } from "../../../../../lib/turso-db";

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

// Registra na conversa uma mensagem gerada pela própria interface — hoje, o resumo das
// alterações que o usuário confirmou. Além de virar histórico, faz o card de confirmação
// deixar de ser a última mensagem, evitando que a mesma proposta seja aplicada duas vezes.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const { content } = await req.json().catch(() => ({}));

  if (!content || typeof content !== "string" || !content.trim()) {
    return new Response(
      JSON.stringify({ error: "Conteúdo da mensagem é obrigatório" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const chat = await tursoDb.chat.findUnique({
    where: { id: chatId, userId: user.id },
    select: { id: true },
  });

  if (!chat) {
    return new Response(
      JSON.stringify({ error: "Conversa não encontrada" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const message = await tursoDb.message.create({
      data: { chatId, role: "assistant", content: content.trim() },
    });
    await tursoDb.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });

    return new Response(
      JSON.stringify({ message: { role: message.role, content: message.content } }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao registrar mensagem na conversa:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao registrar mensagem na conversa" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
