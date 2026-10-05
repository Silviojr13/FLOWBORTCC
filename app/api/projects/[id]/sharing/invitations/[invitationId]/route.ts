import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";

// DELETE: cancela um convite (por e-mail ou o link). Quem já aceitou continua no projeto.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  const { id: projectId, invitationId } = await params;
  const gate = await authorizeProject(projectId, { managePeople: true });
  if (gate instanceof Response) return gate;

  const { count } = await tursoDb.projectInvitation.updateMany({
    where: { id: invitationId, projectId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  return NextResponse.json({ revoked: true });
}
