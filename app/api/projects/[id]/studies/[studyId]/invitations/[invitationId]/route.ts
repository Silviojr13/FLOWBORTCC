import { NextRequest } from "next/server";
import { cancelInvitationResponse, projectStudyGuard } from "@/lib/study-admin";

// DELETE: cancela um convite por e-mail que ainda não foi aceito.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; studyId: string; invitationId: string }> }
) {
  const { id, studyId, invitationId } = await params;
  const guard = await projectStudyGuard(id, studyId);
  if (guard instanceof Response) return guard;
  return cancelInvitationResponse(studyId, invitationId);
}
