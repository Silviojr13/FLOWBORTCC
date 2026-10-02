import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { parseResourceInput } from "@/lib/resources-server";

async function ownedProject(projectId: string, userId: string) {
  return tursoDb.project.findUnique({ where: { id: projectId, userId }, select: { id: true } });
}

// GET: recursos do projeto (pessoas, equipamentos, software e serviços, espaços).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!(await ownedProject(projectId, user.id))) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const resources = await tursoDb.resource.findMany({
    where: { projectId },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ resources });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!(await ownedProject(projectId, user.id))) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const parsed = await parseResourceInput(await req.json(), projectId, false);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { name, type, unitCost, quantity, ...rest } = parsed.data;
    const resource = await tursoDb.resource.create({
      data: { name: name!, type: type!, unitCost: unitCost!, quantity: quantity!, ...rest, projectId },
    });
    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar recurso:", error);
    return NextResponse.json({ error: "Erro ao criar o recurso" }, { status: 500 });
  }
}
