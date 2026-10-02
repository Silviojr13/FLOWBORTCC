import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { parseResourceInput } from "@/lib/resources-server";

type Params = { params: Promise<{ id: string; resourceId: string }> };

async function ownedResource(projectId: string, resourceId: string, userId: string) {
  return tursoDb.resource.findFirst({
    where: { id: resourceId, projectId, project: { userId } },
    select: { id: true },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: projectId, resourceId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!(await ownedResource(projectId, resourceId, user.id))) {
    return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
  }

  const parsed = await parseResourceInput(await req.json(), projectId, true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const resource = await tursoDb.resource.update({ where: { id: resourceId }, data: parsed.data });
    return NextResponse.json({ resource });
  } catch (error) {
    console.error("Erro ao atualizar recurso:", error);
    return NextResponse.json({ error: "Erro ao atualizar o recurso" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: projectId, resourceId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!(await ownedResource(projectId, resourceId, user.id))) {
    return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
  }

  await tursoDb.resource.delete({ where: { id: resourceId } });
  return NextResponse.json({ deleted: true });
}
