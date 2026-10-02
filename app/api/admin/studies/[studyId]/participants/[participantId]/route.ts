import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { isAdmin } from "@/lib/study-server";

// DELETE: remove uma participação (ex.: testes da equipe antes da validação). Os projetos
// da conta não são afetados; só o progresso e as respostas desta avaliação.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ studyId: string; participantId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Acesso restrito ao admin" }, { status: 403 });

  const { studyId, participantId } = await params;
  const removed = await tursoDb.studyParticipant.deleteMany({ where: { id: participantId, studyId } });
  if (removed.count === 0) return NextResponse.json({ error: "Participação não encontrada" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
