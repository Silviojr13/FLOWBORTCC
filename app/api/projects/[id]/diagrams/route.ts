import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { getDiagramType } from "@/lib/diagrams";
import { DiagramGenerationError, generateDiagram } from "@/lib/diagrams-server";

// GET: diagramas do projeto, do mais recente para o mais antigo.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  }

  const project = await tursoDb.project.findUnique({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const diagrams = await tursoDb.diagram.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ diagrams });
}

// POST: gera um diagrama do tipo pedido (pela IA ou a partir dos dados) e o guarda.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  }

  const project = await tursoDb.project.findUnique({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const { type, instructions } = await req.json();
  const info = typeof type === "string" ? getDiagramType(type) : undefined;
  if (!info) {
    return NextResponse.json({ error: "Tipo de diagrama inválido" }, { status: 400 });
  }

  const focus =
    info.engine === "ia" && typeof instructions === "string" && instructions.trim()
      ? instructions.trim().slice(0, 500)
      : null;

  try {
    const { code, source } = await generateDiagram({
      type: info.key,
      projectId,
      userId: user.id,
      instructions: focus ?? undefined,
    });
    const diagram = await tursoDb.diagram.create({
      data: { title: info.label, type: info.key, code, instructions: focus, source, projectId },
    });
    return NextResponse.json({ diagram }, { status: 201 });
  } catch (error) {
    if (error instanceof DiagramGenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao gerar diagrama:", error);
    return NextResponse.json({ error: "Erro ao gerar o diagrama" }, { status: 500 });
  }
}
