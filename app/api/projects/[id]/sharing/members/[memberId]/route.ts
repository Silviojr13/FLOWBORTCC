import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { isMemberRole } from "@/lib/project-permissions";
import { tursoDb } from "@/lib/turso-db";

type Params = { params: Promise<{ id: string; memberId: string }> };

// PATCH: muda o cargo de um membro e/ou, para o visitante, se ele vê custos e recursos.
// Ninguém muda o próprio cargo, para não se trancar fora do projeto por engano.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: projectId, memberId } = await params;
  const gate = await authorizeProject(projectId, { managePeople: true });
  if (gate instanceof Response) return gate;

  const { role, canSeeCosts } = await req.json().catch(() => ({}));
  if (role !== undefined && !isMemberRole(role)) {
    return NextResponse.json({ error: "Cargo inválido (gestor, funcionario, estagiario ou visitante)." }, { status: 400 });
  }
  if (canSeeCosts !== undefined && typeof canSeeCosts !== "boolean") {
    return NextResponse.json({ error: "Informe se o membro pode ver custos." }, { status: 400 });
  }
  if (role === undefined && canSeeCosts === undefined) {
    return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
  }

  const member = await tursoDb.projectMember.findFirst({
    where: { id: memberId, projectId },
    select: { id: true, userId: true },
  });
  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  if (role !== undefined && member.userId === gate.user.id) {
    return NextResponse.json({ error: "Você não pode mudar o próprio cargo." }, { status: 403 });
  }

  const updated = await tursoDb.projectMember.update({
    where: { id: member.id },
    data: { ...(role !== undefined ? { role } : {}), ...(canSeeCosts !== undefined ? { canSeeCosts } : {}) },
    select: { role: true, canSeeCosts: true },
  });
  return NextResponse.json({ member: updated });
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
