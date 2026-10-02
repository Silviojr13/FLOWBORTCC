import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { isAdmin } from "@/lib/study-server";

// DELETE: cancela um convite por e-mail que ainda não foi aceito.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ studyId: string; invitationId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Acesso restrito ao admin" }, { status: 403 });

  const { studyId, invitationId } = await params;
  const removed = await tursoDb.studyInvitation.deleteMany({
    where: { id: invitationId, studyId, acceptedAt: null },
  });
  if (removed.count === 0) {
    return NextResponse.json({ error: "Convite não encontrado ou já aceito." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
