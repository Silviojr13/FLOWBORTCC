import { NextRequest } from "next/server";

export const runtime = "nodejs";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const { messages, model = "gemma-4-31b-it" } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  const lastUserMsg = messages[messages.length - 1];
  console.log("\n─────────────────────────────────────");
  console.log(`[${new Date().toLocaleTimeString("pt-BR")}] USUÁRIO → ${lastUserMsg.content}`);
  console.log(`Modelo: ${model}`);
  console.log("─────────────────────────────────────");

  const body = {
    contents: messages.map((m: Message) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 2048 },
  };

  let geminiRes: Response;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Não foi possível conectar à API do Google." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!geminiRes.ok) {
    const text = await geminiRes.text();
    return new Response(
      JSON.stringify({ error: `Erro ${geminiRes.status}: ${text}` }),
      { status: geminiRes.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body!.getReader();
      const decoder = new TextDecoder();
      process.stdout.write("[GEMMA] ");
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
                controller.enqueue(encoder.encode(token));
              }
            } catch { /* skip */ }
          }
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}