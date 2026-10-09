import { NextRequest } from "next/server";
import { deleteStudyResponse, projectStudyGuard, studyDetailResponse, updateStudyResponse } from "@/lib/study-admin";

type Params = { params: Promise<{ id: string; studyId: string }> };

// GET: avaliação e resultados consolidados (SUS, tarefas, perfil, respostas abertas).
export async function GET(_req: NextRequest, { params }: Params) {
  const { id, studyId } = await params;
  const guard = await projectStudyGuard(id, studyId);
  if (guard instanceof Response) return guard;
  return studyDetailResponse(studyId);
}

// PATCH: textos exibidos ao participante e status (aberta/encerrada).
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, studyId } = await params;
  const guard = await projectStudyGuard(id, studyId);
  if (guard instanceof Response) return guard;
  return updateStudyResponse(studyId, await req.json().catch(() => ({})));
}

// DELETE: exclui a avaliação com participações e respostas (as contas não são afetadas).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, studyId } = await params;
  const guard = await projectStudyGuard(id, studyId);
  if (guard instanceof Response) return guard;
  return deleteStudyResponse(studyId);
}
