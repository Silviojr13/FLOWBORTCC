import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { getPageTutorial } from "@/lib/page-tutorials";

function parse(raw: string | null | undefined): Record<string, string> {
  try {
    const value = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

/** Aviso de novidade já mostrado: guardado no mesmo JSON, com prefixo, sem contar como visto. */
const SEEN_PREFIX = "novidade:";

// GET: tutoriais por página já concluídos, os avisos de novidade já mostrados e, para o aviso
// de novidade, quando a pessoa entrou e se ela já passou pelo tour inicial.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const record = await tursoDb.user.findUnique({
    where: { id: user.id },
    select: { tutorialProgress: true, createdAt: true, tourCompletedAt: true },
  });
  return NextResponse.json({
    progress: parse(record?.tutorialProgress),
    joinedAt: record?.createdAt.toISOString() ?? null,
    tourDone: Boolean(record?.tourCompletedAt),
  });
}

// PATCH: { key } marca um tutorial como concluído; { seen: [keys] } registra que o aviso de
// novidade desses tutoriais já apareceu; { reset: true } zera o progresso.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const record = await tursoDb.user.findUnique({ where: { id: user.id }, select: { tutorialProgress: true } });
  let progress = parse(record?.tutorialProgress);

  if (body.reset === true) {
    progress = {};
  } else if (Array.isArray(body.seen)) {
    const now = new Date().toISOString();
    for (const key of body.seen) {
      if (typeof key === "string" && getPageTutorial(key)) progress[`${SEEN_PREFIX}${key}`] = now;
    }
  } else if (typeof body.key === "string" && getPageTutorial(body.key)) {
    progress[body.key] = new Date().toISOString();
  } else {
    return NextResponse.json({ error: "Tutorial inválido" }, { status: 400 });
  }

  await tursoDb.user.update({ where: { id: user.id }, data: { tutorialProgress: JSON.stringify(progress) } });
  return NextResponse.json({ progress });
}
