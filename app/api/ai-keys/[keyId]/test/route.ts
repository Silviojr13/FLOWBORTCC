import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { testConnection } from "@/lib/ai-client";
import { AI_KEY_SUMMARY_SELECT, aiKeyErrorResponse, loadAiTarget, toAiKeySummary } from "@/lib/user-ai-keys";

export const runtime = "nodejs";

type Params = { params: Promise<{ keyId: string }> };

// POST: confere se a chave e o modelo ainda funcionam (crédito, chave revogada...).
export async function POST(_req: NextRequest, { params }: Params) {
  const { keyId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const target = await loadAiTarget(keyId, user.id);
  if (!target) {
    return NextResponse.json(
      { error: "Não foi possível abrir essa chave (o segredo do servidor mudou?). Remova e conecte a IA de novo." },
      { status: 404 }
    );
  }

  try {
    await testConnection(target);
  } catch (error) {
    return aiKeyErrorResponse(error, target.provider);
  }

  const updated = await tursoDb.userAiKey.update({
    where: { id: keyId },
    data: { lastTestedAt: new Date() },
    select: AI_KEY_SUMMARY_SELECT,
  });
  return NextResponse.json({ key: toAiKeySummary(updated) });
}
