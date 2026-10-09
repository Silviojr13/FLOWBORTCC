import { NextRequest, NextResponse } from "next/server";
import { createStudy, listStudies, projectStudyGuard } from "@/lib/study-admin";

type Params = { params: Promise<{ id: string }> };

// GET: avaliações de usabilidade deste projeto (dono e gestores).
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const guard = await projectStudyGuard(projectId);
  if (guard instanceof Response) return guard;
  return NextResponse.json({ studies: await listStudies(projectId) });
}

// POST: cria uma avaliação do projeto com os textos padrão e um código de convite novo.
export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const guard = await projectStudyGuard(projectId);
  if (guard instanceof Response) return guard;
  const { title } = await req.json().catch(() => ({}));
  return NextResponse.json({ study: await createStudy(guard.userId, title, projectId) }, { status: 201 });
}
