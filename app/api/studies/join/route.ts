import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { loadParticipation } from "@/lib/study-server";

// POST: aceita o convite. Exige o aceite explícito do termo de participação.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const { code, consent } = await req.json().catch(() => ({}));
  if (consent !== true) {
    return NextResponse.json({ error: "É preciso aceitar o termo de participação." }, { status: 400 });
  }

  const study = typeof code === "string" ? await tursoDb.study.findUnique({ where: { inviteCode: code } }) : null;
  if (!study) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  if (study.status !== "aberta") {
    return NextResponse.json({ error: "Esta avaliação já foi encerrada." }, { status: 409 });
  }

  await tursoDb.studyParticipant.upsert({
    where: { studyId_userId: { studyId: study.id, userId: user.id } },
    create: { studyId: study.id, userId: user.id },
    update: {},
  });

  return NextResponse.json({ participation: await loadParticipation(user.id) }, { status: 201 });
}
