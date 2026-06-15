import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { tursoDb } from "../../../lib/turso-db";

export const runtime = "nodejs";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  // Verificar se o usuário está autenticado
  const user = await getCurrentUser();
  
  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, model = "gemini-2.5-flash", chatId: providedChatId } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  const lastUserMsg = messages[messages.length - 1];
  console.log("\n─────────────────────────────────────");
  console.log(`[${new Date().toLocaleTimeString("pt-BR")}] USUÁRIO → ${lastUserMsg.content}`);
  console.log(`Modelo: ${model}`);
  console.log("─────────────────────────────────────");

  // Determinar o chatId: usar o fornecido ou criar um novo
  let chatId: string;
  if (providedChatId) {
    // Usar o chatId fornecido
    chatId = providedChatId;
  } else {
    // Criar um novo chat
    const chatTitle = lastUserMsg.content.slice(0, 30) + (lastUserMsg.content.length > 30 ? "..." : "");
    const chat = await tursoDb.chat.create({
      data: {
        title: chatTitle,
        userId: user.id,
      },
    });
    chatId = chat.id;
  }

  // Salvar a mensagem do usuário no banco de dados
  const userMessage = await tursoDb.message.create({
    data: {
      chatId: chatId,
      role: 'user',
      content: lastUserMsg.content,
    },
  });

  const body = {
    contents: messages.map((m: Message) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 2048 },
  };

  // Logging detalhado da chamada à API do Google
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  console.log(`[DEBUG] Chamando API do Google:`);
  console.log(`[DEBUG] URL: ${apiUrl}`);
  console.log(`[DEBUG] Modelo: ${model}`);
  console.log(`[DEBUG] Corpo da requisição:`, JSON.stringify(body, null, 2));

  let geminiRes: Response;
  try {
    geminiRes = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.log(`[DEBUG] Status da resposta: ${geminiRes.status}`);
  } catch (error) {
    console.error('[ERROR] Falha na conexão com a API do Google:', error);
    return new Response(
      JSON.stringify({ 
        error: "Não foi possível conectar à API do Google.",
        details: error instanceof Error ? error.message : String(error),
        modelUsed: model,
        urlCalled: apiUrl
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!geminiRes.ok) {
    const errorBody = await geminiRes.text();
    console.log(`[ERROR] Resposta de erro da API do Google:`, errorBody);
    return new Response(
      JSON.stringify({ 
        error: `Erro ${geminiRes.status}: ${errorBody}`,
        modelUsed: model,
        urlCalled: apiUrl
      }),
      { status: geminiRes.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body!.getReader();
      const decoder = new TextDecoder();
      process.stdout.write("[GEMMA] ");
      let fullResponse = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const json = line.replace("data: ", "").trim();
            if (!json || json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const token = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
              if (token) {
                process.stdout.write(token);
                fullResponse += token;
                controller.enqueue(encoder.encode(token));
              }
            } catch { /* skip */ }
          }
        }

        // Salvar a resposta da IA no banco de dados após completar a resposta
        if (fullResponse.trim()) {
          await tursoDb.message.create({
            data: {
              chatId: chatId,
              role: 'assistant',
              content: fullResponse,
            },
          });
        }

        console.log("\n[GEMMA] ✓ Resposta completa");
        console.log("─────────────────────────────────────\n");
        controller.close();
      } catch (err) {
        console.error("\n[ERRO] Stream interrompido:", err);
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
  });

  // Retornar o chatId no header para o frontend
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "X-Chat-Id": chatId,
    },
  });
}