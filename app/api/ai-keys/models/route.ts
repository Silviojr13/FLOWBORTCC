import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listModels } from "@/lib/ai-client";
import { isAiProvider } from "@/lib/ai-providers";
import { aiKeyErrorResponse, loadAiTarget } from "@/lib/user-ai-keys";

export const runtime = "nodejs";

// POST: lista os modelos que uma chave pode usar. Recebe a chave digitada (antes de salvar)
// ou o id de uma IA já conectada (para trocar o modelo).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let provider = body.provider;
  let apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  if (typeof body.keyId === "string" && body.keyId) {
    const target = await loadAiTarget(body.keyId, user.id);
    if (!target) return NextResponse.json({ error: "Essa IA não foi encontrada. Conecte-a de novo." }, { status: 404 });
    provider = target.provider;
    apiKey = target.apiKey;
  }

  if (!isAiProvider(provider)) return NextResponse.json({ error: "Escolha o provedor da IA." }, { status: 400 });
  if (!apiKey || apiKey.length > 400 || /\s/.test(apiKey)) {
    return NextResponse.json({ error: "Cole a chave de API completa, sem espaços." }, { status: 400 });
  }

  try {
    return NextResponse.json({ models: await listModels(provider, apiKey) });
  } catch (error) {
    return aiKeyErrorResponse(error, provider);
  }
}
