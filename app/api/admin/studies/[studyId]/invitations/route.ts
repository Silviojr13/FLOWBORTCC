import { NextRequest } from "next/server";
import { adminGuard, inviteResponse, listInvitationsResponse } from "@/lib/study-admin";

type Params = { params: Promise<{ studyId: string }> };

// GET: convites por e-mail desta avaliação.
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await adminGuard();
  if (guard instanceof Response) return guard;
  return listInvitationsResponse((await params).studyId);
}

// POST: convida um e-mail exato.
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await adminGuard();
  if (guard instanceof Response) return guard;
  const { email } = await req.json().catch(() => ({}));
  return inviteResponse((await params).studyId, email);
}
