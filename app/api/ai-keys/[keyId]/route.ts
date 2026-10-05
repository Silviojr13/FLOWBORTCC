import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { testConnection } from "@/lib/ai-client";
import { AI_KEY_SUMMARY_SELECT, aiKeyErrorResponse, loadAiTarget, toAiKeySummary } from "@/lib/user-ai-keys";

export const runtime = "nodejs";

type Params = { params: Promise<{ keyId: string }> };

// PATCH: troca o modelo ou o apelido e escolhe se a IA responde no assistente.
// Um modelo novo é testado antes de valer.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { keyId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const model = typeof body.model === "string" ? body.model.trim() : undefined;
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 40) : undefined;
  const useInAssistant = typeof body.useInAssistant === "boolean" ? body.useInAssistant : undefined;
  if (model !== undefined && (!model || model.length > 120)) {
    return NextResponse.json({ error: "Escolha o modelo da IA." }, { status: 400 });
  }
  if (model === undefined && label === undefined && useInAssistant === undefined) {
    return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
  }

  const target = await loadAiTarget(keyId, user.id);
  if (!target) return NextResponse.json({ error: "Essa IA não foi encontrada. Conecte-a de novo." }, { status: 404 });

  const modelChanged = model !== undefined && model !== target.model;
  if (modelChanged) {
    try {
      await testConnection({ ...target, model });
    } catch (error) {
      return aiKeyErrorResponse(error, target.provider);
    }
  }

  const updated = await tursoDb.$transaction(async (tx) => {
    if (useInAssistant) {
      await tx.userAiKey.updateMany({
        where: { userId: user.id, useInAssistant: true, NOT: { id: keyId } },
        data: { useInAssistant: false },
      });
    }
    return tx.userAiKey.update({
      where: { id: keyId },
      data: {
        ...(modelChanged ? { model, lastTestedAt: new Date() } : {}),
        ...(label !== undefined ? { label: label || null } : {}),
        ...(useInAssistant !== undefined ? { useInAssistant } : {}),
      },
      select: AI_KEY_SUMMARY_SELECT,
    });
  });

  return NextResponse.json({ key: toAiKeySummary(updated) });
}

// DELETE: desconecta a IA e apaga a chave guardada.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { keyId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const { count } = await tursoDb.userAiKey.deleteMany({ where: { id: keyId, userId: user.id } });
  if (count === 0) return NextResponse.json({ error: "Essa IA não foi encontrada." }, { status: 404 });
  return NextResponse.json({ removed: true });
}
