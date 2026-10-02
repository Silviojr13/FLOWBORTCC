import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";

type Params = { params: Promise<{ id: string; diagramId: string }> };

async function findOwnedDiagram(projectId: string, diagramId: string, userId: string) {
  return tursoDb.diagram.findFirst({
    where: { id: diagramId, projectId, project: { userId } },
  });
}

// PATCH: renomeia ou salva o código editado à mão.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: projectId, diagramId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  }

  const diagram = await findOwnedDiagram(projectId, diagramId, user.id);
  if (!diagram) {
    return NextResponse.json({ error: "Diagrama não encontrado" }, { status: 404 });
  }

  const { title, code } = await req.json();
  const data: { title?: string; code?: string; source?: string } = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim().slice(0, 120);
  if (typeof code === "string" && code.trim() && code !== diagram.code) {
    data.code = code;
    data.source = "manual";
  }

  const updated = await tursoDb.diagram.update({ where: { id: diagramId }, data });
  return NextResponse.json({ diagram: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: projectId, diagramId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  }

  const diagram = await findOwnedDiagram(projectId, diagramId, user.id);
  if (!diagram) {
    return NextResponse.json({ error: "Diagrama não encontrado" }, { status: 404 });
  }

  await tursoDb.diagram.delete({ where: { id: diagramId } });
  return NextResponse.json({ deleted: true });
}
