import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { isAdmin, newInviteCode } from "@/lib/study-server";
import { DEFAULT_STUDY } from "@/lib/study";

// GET: avaliações criadas (só admin), com a contagem de participantes e questionários.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Acesso restrito ao admin" }, { status: 403 });

  const studies = await tursoDb.study.findMany({
    orderBy: { createdAt: "desc" },
    include: { participants: { select: { submittedAt: true } } },
  });

  return NextResponse.json({
    studies: studies.map(({ participants, ...s }) => ({
      ...s,
      joined: participants.length,
      submitted: participants.filter((p) => p.submittedAt).length,
    })),
  });
}

// POST: cria uma avaliação com os textos padrão e um código de convite novo.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Acesso restrito ao admin" }, { status: 403 });

  const { title } = await req.json().catch(() => ({}));
  const study = await tursoDb.study.create({
    data: {
      title: typeof title === "string" && title.trim() ? title.trim().slice(0, 120) : DEFAULT_STUDY.title,
      intro: DEFAULT_STUDY.intro,
      privacy: DEFAULT_STUDY.privacy,
      contact: DEFAULT_STUDY.contact,
      inviteCode: newInviteCode(),
      createdById: user.id,
    },
  });
  return NextResponse.json({ study }, { status: 201 });
}
