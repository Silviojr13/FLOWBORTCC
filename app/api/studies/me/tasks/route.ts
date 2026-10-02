import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { loadParticipation } from "@/lib/study-server";
import { isStudyTaskKey } from "@/lib/study";

/**
 * POST: marca ou desmarca uma tarefa do roteiro.
 * - pelo participante: { taskKey, done } → marcação "manual";
 * - pela própria tela (ex.: o PDF exportado no navegador): { taskKey, done: true, auto: true }.
 * Sem participação ativa, responde 204 sem efeito: as telas avisam sem saber se o usuário participa.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const { taskKey, done, auto } = await req.json().catch(() => ({}));
  if (!isStudyTaskKey(taskKey) || typeof done !== "boolean") {
    return NextResponse.json({ error: "Tarefa inválida." }, { status: 400 });
  }

  const participant = await tursoDb.studyParticipant.findFirst({
    where: { userId: user.id, study: { status: "aberta" } },
    orderBy: { consentAt: "desc" },
    select: { id: true, submittedAt: true },
  });
  if (!participant) return new NextResponse(null, { status: 204 });
  if (participant.submittedAt) {
    return NextResponse.json({ error: "O questionário já foi enviado." }, { status: 409 });
  }

  const key = { participantId_taskKey: { participantId: participant.id, taskKey } };
  if (done) {
    await tursoDb.studyTaskProgress.upsert({
      where: key,
      create: { participantId: participant.id, taskKey, method: auto === true ? "auto" : "manual" },
      update: {},
    });
  } else {
    // Só a marcação manual pode ser desfeita; a automática volta na próxima detecção.
    await tursoDb.studyTaskProgress.deleteMany({
      where: { participantId: participant.id, taskKey, method: "manual" },
    });
  }

  return NextResponse.json({ participation: await loadParticipation(user.id) });
}
