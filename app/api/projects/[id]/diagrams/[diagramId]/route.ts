import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";

type Params = { params: Promise<{ id: string; diagramId: string }> };

async function findProjectDiagram(projectId: string, diagramId: string) {
  return tursoDb.diagram.findFirst({ where: { id: diagramId, projectId } });
}

// PATCH: renomeia ou salva o código editado à mão.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: projectId, diagramId } = await params;
  const gate = await authorizeProject(projectId, { edit: "diagramas" });
  if (gate instanceof Response) return gate;

  const diagram = await findProjectDiagram(projectId, diagramId);
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
  const gate = await authorizeProject(projectId, { edit: "diagramas" });
  if (gate instanceof Response) return gate;

  const diagram = await findProjectDiagram(projectId, diagramId);
  if (!diagram) {
    return NextResponse.json({ error: "Diagrama não encontrado" }, { status: 404 });
  }

  await tursoDb.diagram.delete({ where: { id: diagramId } });
  return NextResponse.json({ deleted: true });
}
