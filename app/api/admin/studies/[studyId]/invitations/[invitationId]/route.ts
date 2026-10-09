import { NextRequest } from "next/server";
import { adminGuard, cancelInvitationResponse } from "@/lib/study-admin";

// DELETE: cancela um convite por e-mail que ainda não foi aceito.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ studyId: string; invitationId: string }> }
) {
  const guard = await adminGuard();
  if (guard instanceof Response) return guard;
  const { studyId, invitationId } = await params;
  return cancelInvitationResponse(studyId, invitationId);
}
