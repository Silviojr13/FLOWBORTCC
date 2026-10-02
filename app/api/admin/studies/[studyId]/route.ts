import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { isAdmin } from "@/lib/study-server";
import { buildStudyResults } from "@/lib/study-results";

type Params = { params: Promise<{ studyId: string }> };

async function guard() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Acesso restrito ao admin" }, { status: 403 });
  return null;
}

// GET: avaliação e resultados consolidados (SUS, tarefas, perfil, respostas abertas).
export async function GET(_req: NextRequest, { params }: Params) {
  const denied = await guard();
  if (denied) return denied;
  const { studyId } = await params;

  const study = await tursoDb.study.findUnique({ where: { id: studyId } });
  if (!study) return NextResponse.json({ error: "Avaliação não encontrada" }, { status: 404 });

  return NextResponse.json({ study, results: await buildStudyResults(studyId) });
}

// PATCH: textos exibidos ao participante e status (aberta/encerrada).
export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await guard();
  if (denied) return denied;
  const { studyId } = await params;

  const body = await req.json().catch(() => ({}));
  const data: Record<string, string | null> = {};
  for (const [field, max] of [["title", 120], ["intro", 4000], ["privacy", 4000]] as const) {
    if (typeof body[field] === "string" && body[field].trim()) data[field] = body[field].trim().slice(0, max);
  }
  if (typeof body.contact === "string") data.contact = body.contact.trim().slice(0, 300) || null;
  if (body.status === "aberta" || body.status === "encerrada") data.status = body.status;

  const exists = await tursoDb.study.findUnique({ where: { id: studyId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Avaliação não encontrada" }, { status: 404 });

  const study = await tursoDb.study.update({ where: { id: studyId }, data });
  return NextResponse.json({ study });
}

// DELETE: exclui a avaliação com participações e respostas (as contas não são afetadas).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = await guard();
  if (denied) return denied;
  const { studyId } = await params;

  const removed = await tursoDb.study.deleteMany({ where: { id: studyId } });
  if (removed.count === 0) return NextResponse.json({ error: "Avaliação não encontrada" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
