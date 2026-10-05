import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";

type Params = { params: Promise<{ id: string; memberId: string }> };

// PATCH: ajusta o acesso de um membro. Por enquanto, se o visitante vê custos e recursos.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: projectId, memberId } = await params;
  const gate = await authorizeProject(projectId, { managePeople: true });
  if (gate instanceof Response) return gate;

  const { canSeeCosts } = await req.json().catch(() => ({}));
  if (typeof canSeeCosts !== "boolean") {
    return NextResponse.json({ error: "Informe se o membro pode ver custos." }, { status: 400 });
  }

  const { count } = await tursoDb.projectMember.updateMany({
    where: { id: memberId, projectId },
    data: { canSeeCosts },
  });
  if (count === 0) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  return NextResponse.json({ updated: true });
}

// DELETE: remove alguém do projeto. Quem gerencia remove qualquer membro; um membro pode
// remover a si mesmo (sair do projeto).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: projectId, memberId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

  const member = await tursoDb.projectMember.findFirst({
    where: { id: memberId, projectId },
    select: { id: true, userId: true },
  });
  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  if (!gate.access.canManagePeople && member.userId !== gate.user.id) {
    return NextResponse.json({ error: "Seu cargo neste projeto não permite esta ação." }, { status: 403 });
  }

  await tursoDb.projectMember.delete({ where: { id: member.id } });
  return NextResponse.json({ removed: true });
}
