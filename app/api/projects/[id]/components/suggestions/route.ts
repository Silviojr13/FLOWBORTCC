import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { tursoDb } from "../../../../../../lib/turso-db";

export const runtime = "nodejs";

const CATEGORIES = ["Sensor", "Atuador", "Controlador", "Alimentação", "Conectividade", "Estrutura", "Outro"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const project = await tursoDb.project.findUnique({ where: { id: projectId, userId: user.id } });
  if (!project) {
    return new Response(
      JSON.stringify({ error: "Projeto não encontrado" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const [requirements, features] = await Promise.all([
    tursoDb.requirement.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
    tursoDb.feature.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
  ]);

  if (requirements.length === 0 && features.length === 0) {
    return new Response(
      JSON.stringify({
        error: "Cadastre ao menos um requisito ou uma funcionalidade antes de gerar sugestões de componentes.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY não configurada no servidor." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const requirementsList = requirements
    .map((r) => `- ${r.code} (${r.category}, prioridade ${r.priority}): ${r.description}`)
    .join("\n") || "Nenhum requisito cadastrado ainda.";

  const featuresList = features
    .map((f) => `- ${f.name}${f.description ? `: ${f.description}` : ""}`)
    .join("\n") || "Nenhuma funcionalidade cadastrada ainda.";

  const prompt = `Você é um especialista em componentes eletrônicos para projetos de robótica e sistemas embarcados.

Projeto: "${project.name}"${project.description ? ` — ${project.description}` : ""}

Requisitos cadastrados:
${requirementsList}

Funcionalidades cadastradas:
${featuresList}

Com base nisso, sugira entre 6 e 10 componentes físicos concretos (sensores, atuadores, controladores/microcontroladores, alimentação, conectividade, estrutura) que fazem sentido para este projeto especificamente — nada genérico. Para cada um, explique em uma frase curta por que ele atende a um requisito ou funcionalidade específico do projeto. Estime uma faixa de preço em reais (BRL) realista para o mercado brasileiro. Responda em português brasileiro.

Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, exatamente neste formato:
{
  "suggestions": [
    {
      "category": "uma de: ${CATEGORIES.join(", ")}",
      "name": "string",
      "description": "string",
      "estimatedMinPrice": number,
      "estimatedMaxPrice": number,
      "reason": "string"
    }
  ]
}`;

  try {
    const model = "openai/gpt-oss-120b";
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 2000;
    let groqRes: Response | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 3000,
        }),
      });

      if (groqRes.ok) break;

      const isTransient = groqRes.status === 500 || groqRes.status === 503;
      if (isTransient && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      const text = await groqRes.text();
      console.error("[Groq] Erro ao gerar sugestões:", text);

      if (groqRes.status === 429) {
        return new Response(
          JSON.stringify({
            error: "O limite de requisições da IA foi atingido para esta chave do Groq. Tente novamente em instantes.",
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Não foi possível gerar sugestões agora. Tente novamente." }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await groqRes!.json();
    const rawText: string | undefined = data.choices?.[0]?.message?.content;

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: "A IA não retornou sugestões. Tente novamente." }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(rawText);
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao gerar sugestões de componentes:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao gerar sugestões de componentes." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
