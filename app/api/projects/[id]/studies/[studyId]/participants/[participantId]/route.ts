import { NextRequest } from "next/server";
import { projectStudyGuard, removeParticipantResponse } from "@/lib/study-admin";

// DELETE: remove uma participação (ex.: testes da equipe antes da validação).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; studyId: string; participantId: string }> }
) {
  const { id, studyId, participantId } = await params;
  const guard = await projectStudyGuard(id, studyId);
  if (guard instanceof Response) return guard;
  return removeParticipantResponse(studyId, participantId);
}
