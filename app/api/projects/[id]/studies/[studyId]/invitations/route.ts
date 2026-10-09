import { NextRequest } from "next/server";
import { inviteResponse, listInvitationsResponse, projectStudyGuard } from "@/lib/study-admin";

type Params = { params: Promise<{ id: string; studyId: string }> };

// GET: convites por e-mail desta avaliação.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id, studyId } = await params;
  const guard = await projectStudyGuard(id, studyId);
  if (guard instanceof Response) return guard;
  return listInvitationsResponse(studyId);
}

// POST: convida um e-mail exato.
export async function POST(req: NextRequest, { params }: Params) {
  const { id, studyId } = await params;
  const guard = await projectStudyGuard(id, studyId);
  if (guard instanceof Response) return guard;
  const { email } = await req.json().catch(() => ({}));
  return inviteResponse(studyId, email);
}
