import { NextRequest, NextResponse } from "next/server";
import { adminGuard, createStudy, listStudies } from "@/lib/study-admin";

// GET: todas as avaliações (só admin), com a contagem de participantes e questionários.
export async function GET() {
  const guard = await adminGuard();
  if (guard instanceof Response) return guard;
  return NextResponse.json({ studies: await listStudies() });
}

// POST: cria uma avaliação com os textos padrão e um código de convite novo.
export async function POST(req: NextRequest) {
  const guard = await adminGuard();
  if (guard instanceof Response) return guard;
  const { title } = await req.json().catch(() => ({}));
  return NextResponse.json({ study: await createStudy(guard.userId, title) }, { status: 201 });
}
