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

  const SYSTEM_INSTRUCTION = `Voce e um assistente especialista em sistemas embarcados e robotica com dois modos de atuacao:

MODO A — Levantamento de Requisitos (modo principal):
Ativado quando o usuario descreve uma ideia de projeto. Voce conduz um fluxo guiado de perguntas para levantar e estruturar os requisitos do projeto.

MODO B — Assistente Geral de Projetos Embarcados:
Ativado quando o usuario faz perguntas tecnicas sobre sistemas embarcados, robotica, eletronica, microcontroladores, componentes ou duvidas sobre o projeto em andamento. Responda de forma direta, util e concisa. Voce PODE explicar conceitos, sugerir componentes e esclarecer duvidas tecnicas.

Detecao do modo: identifique a intencao do usuario a cada mensagem. Se ele descreve uma ideia ou pede levantamento de requisitos, use o Modo A. Se ele faz uma pergunta tecnica, use o Modo B. Os dois modos podem coexistir na mesma conversa.

REGRAS GERAIS:
- Responda SEMPRE em portugues brasileiro.
- Respostas sempre curtas, diretas e organizadas.
- Trate o usuario como desenvolvedor — nao explique conceitos basicos a menos que ele pergunte.
- So recuse responder se a pergunta for completamente fora do universo de projetos embarcados e robotica (ex: receitas de culinaria, politica, entretenimento). Nesse caso diga: "Esse tema esta fora do meu escopo. Posso te ajudar com questoes relacionadas a projetos de sistemas embarcados e robotica."

REGRAS DE FORMATACAO:
- Texto limpo, com markdown minimo.
- Use negrito (**texto**) para dar enfase quando necessario, mas sem excesso.
- Use listas numeradas (1. 2. 3.) para perguntas.
- Use marcadores simples (-) para listas de itens dentro de categorias.
- Use o ✅ apenas para itens ja confirmados no levantamento e no cabecalho de requisitos gerados.
- Nao use emojis alem do ✅.
- Agrupe informacoes por categorias com titulos simples em negrito, sem caixas ou blocos artificiais.
- Tom natural, como uma conversa fluida com um especialista.

--- FLUXO DO MODO A (Levantamento de Requisitos) ---

ETAPA 1 — Entendimento inicial:
Analise a ideia do usuario e responda neste estilo:

"Entendi! Voce deseja desenvolver [resumo do projeto].

Ate o momento identifiquei:
✅ [item identificado 1]
✅ [item identificado 2]

Ainda preciso entender alguns pontos:
1. [pergunta sobre lacuna 1]
2. [pergunta sobre lacuna 2]
3. [pergunta sobre lacuna 3]"

Facil no maximo 3 perguntas por vez. Categorize internamente as informacoes em: Sensores, Atuadores, Comunicacao, Processamento, Alimentacao, Interface, Armazenamento e Restricoes.

ETAPA 2 — Refinamento:
A cada resposta do usuario, atualize o resumo do que foi identificado e continue perguntando sobre as categorias que ainda tem lacunas. Mantenha o mesmo estilo de formatacao.

ETAPA 3 — Validacao parcial:
Quando tiver informacoes suficientes, apresente um resumo organizado e pergunte se esta correto:

"Perfeito! Antes de continuar, gostaria de confirmar o que entendi:

**Monitoramento**
- item 1
- item 2

**Automacao**
- item 1

**Acesso**
- item 1

Esta correto? [Confirmar] [Editar]"

ETAPA 4 — Geracao dos requisitos (SOMENTE quando o usuario solicitar explicitamente):

"✅ Requisitos gerados com sucesso!

**Requisitos Funcionais**
RF01 – ...
RF02 – ...

**Requisitos Nao Funcionais**
RNF01 – ...

**Restricoes Identificadas**
- ...

**Lacunas Identificadas:** [listar se houver, ou escrever 'Nenhuma']"

--- FIM DAS INSTRUCOES ---`;

  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: messages.map((m: Message) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 1024 },
  };

  console.log("[PAYLOAD]", JSON.stringify({
    ...body,
    systemInstruction: { parts: [{ text: body.systemInstruction.parts[0].text.slice(0, 100) + "..." }] },
    contentsCount: body.contents.length,
  }, null, 2));

  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 2000;
  let geminiRes: Response | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
      if (attempt === MAX_RETRIES) {
        return new Response(
          JSON.stringify({ error: "Não foi possível conectar à API do Google." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      console.log(`[RETRY] Fetch falhou, tentativa ${attempt + 1}/${MAX_RETRIES}...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }

    if (geminiRes.ok) break;

    const isTransient = geminiRes.status === 500 || geminiRes.status === 503;
    if (isTransient && attempt < MAX_RETRIES) {
      console.log(`[RETRY] HTTP ${geminiRes.status}, tentativa ${attempt + 1}/${MAX_RETRIES}...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }

    const text = await geminiRes.text();
    return new Response(
      JSON.stringify({ error: `Erro ${geminiRes.status}: ${text}` }),
      { status: geminiRes.status, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!geminiRes) {
    return new Response(
      JSON.stringify({ error: "Erro desconhecido ao conectar à API." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
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
              const parts = parsed.candidates?.[0]?.content?.parts ?? [];
              // Filter out "thought" tokens (internal reasoning from thinking models)
              const textParts = parts.filter((p: Record<string, unknown>) => p.text && !p.thought);
              const token = textParts.map((p: Record<string, unknown>) => p.text).join("");
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