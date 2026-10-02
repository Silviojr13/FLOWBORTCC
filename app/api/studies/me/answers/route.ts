import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { loadParticipation } from "@/lib/study-server";
import { OPEN_QUESTIONS, PROFILE_QUESTIONS, SUS_ITEMS, susScore, type StudyAnswers } from "@/lib/study";

// POST: envia o questionário (SUS, perguntas abertas e perfil). Uma única vez por participante.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const participant = await tursoDb.studyParticipant.findFirst({
    where: { userId: user.id, study: { status: "aberta" } },
    orderBy: { consentAt: "desc" },
    select: { id: true, submittedAt: true },
  });
  if (!participant) return NextResponse.json({ error: "Você não participa de uma avaliação aberta." }, { status: 404 });
  if (participant.submittedAt) {
    return NextResponse.json({ error: "O questionário já foi enviado." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const sus = Array.isArray(body.sus) ? body.sus.map(Number) : [];
  if (sus.length !== SUS_ITEMS.length || sus.some((v: number) => !Number.isInteger(v) || v < 1 || v > 5)) {
    return NextResponse.json({ error: "Responda às 10 afirmações da escala, de 1 a 5." }, { status: 400 });
  }

  const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 2000) : "");
  const answers: StudyAnswers = {
    sus,
    open: Object.fromEntries(OPEN_QUESTIONS.map((q) => [q.key, text(body.open?.[q.key])])),
    profile: Object.fromEntries(
      PROFILE_QUESTIONS.map((q) => {
        const value = text(body.profile?.[q.key]);
        return [q.key, (q.options as readonly string[]).includes(value) ? value : ""];
      })
    ),
  };

  await tursoDb.studyParticipant.update({
    where: { id: participant.id },
    data: { answers: JSON.stringify(answers), susScore: susScore(sus), submittedAt: new Date() },
  });

  return NextResponse.json({ participation: await loadParticipation(user.id) });
}
