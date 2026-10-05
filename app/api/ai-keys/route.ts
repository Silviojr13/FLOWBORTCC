import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { encryptApiKey, encryptionReady, keyHint } from "@/lib/ai-keys-crypto";
import { testConnection } from "@/lib/ai-client";
import { isAiProvider } from "@/lib/ai-providers";
import { AI_KEY_SUMMARY_SELECT, aiKeyErrorResponse, toAiKeySummary } from "@/lib/user-ai-keys";

export const runtime = "nodejs";

const MAX_KEYS_PER_USER = 10;
const MAX_KEY_LENGTH = 400;
const MAX_MODEL_LENGTH = 120;
const MAX_LABEL_LENGTH = 40;

// GET: as IAs conectadas pela pessoa (sem as chaves) e qual responde no assistente.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const rows = await tursoDb.userAiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: AI_KEY_SUMMARY_SELECT,
  });
  return NextResponse.json({
    keys: rows.map(toAiKeySummary).filter(Boolean),
    encryptionReady: encryptionReady(),
  });
}

// POST: conecta uma IA. A chave só é salva depois de um teste real com o modelo escolhido.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!encryptionReady()) {
    return NextResponse.json({ error: "O servidor ainda não está configurado para guardar chaves de IA." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const provider = body.provider;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, MAX_LABEL_LENGTH) : "";
  const useInAssistant = body.useInAssistant === true;

  if (!isAiProvider(provider)) return NextResponse.json({ error: "Escolha o provedor da IA." }, { status: 400 });
  if (!apiKey || apiKey.length > MAX_KEY_LENGTH || /\s/.test(apiKey)) {
    return NextResponse.json({ error: "Cole a chave de API completa, sem espaços." }, { status: 400 });
  }
  if (!model || model.length > MAX_MODEL_LENGTH) {
    return NextResponse.json({ error: "Escolha o modelo da IA." }, { status: 400 });
  }

  const count = await tursoDb.userAiKey.count({ where: { userId: user.id } });
  if (count >= MAX_KEYS_PER_USER) {
    return NextResponse.json({ error: `Você pode conectar até ${MAX_KEYS_PER_USER} IAs. Remova uma para adicionar outra.` }, { status: 400 });
  }

  try {
    await testConnection({ provider, apiKey, model });
  } catch (error) {
    return aiKeyErrorResponse(error, provider);
  }

  const created = await tursoDb.$transaction(async (tx) => {
    // Só uma IA responde no assistente.
    if (useInAssistant) {
      await tx.userAiKey.updateMany({ where: { userId: user.id, useInAssistant: true }, data: { useInAssistant: false } });
    }
    return tx.userAiKey.create({
      data: {
        userId: user.id,
        provider,
        model,
        label: label || null,
        encryptedKey: encryptApiKey(apiKey),
        keyHint: keyHint(apiKey),
        useInAssistant,
        lastTestedAt: new Date(),
      },
      select: AI_KEY_SUMMARY_SELECT,
    });
  });

  return NextResponse.json({ key: toAiKeySummary(created) }, { status: 201 });
}
