import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";
import { parseResourceInput } from "@/lib/resources-server";

// GET: recursos do projeto (pessoas, equipamentos, software e serviços, espaços). Exige ver
// custos: a aba é o orçamento, com o custo por hora de pessoas.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { costs: true });
  if (gate instanceof Response) return gate;

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
  const gate = await authorizeProject(projectId, { edit: "recursos" });
  if (gate instanceof Response) return gate;

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
