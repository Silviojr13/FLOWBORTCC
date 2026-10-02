import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { DiagramGenerationError, generateDiagram } from "@/lib/diagrams-server";

/**
 * POST: gera de novo um diagrama existente.
 * - com `error`: modo correção — a IA recebe o código atual e o erro do Mermaid;
 * - sem `error`: nova versão a partir do estado atual do projeto.
 * Nos dois casos as instruções guardadas no diagrama continuam valendo.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; diagramId: string }> }
) {
  const { id: projectId, diagramId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  }

  const diagram = await tursoDb.diagram.findFirst({
    where: { id: diagramId, projectId, project: { userId: user.id } },
  });
  if (!diagram) {
    return NextResponse.json({ error: "Diagrama não encontrado" }, { status: 404 });
  }

  const { error } = await req.json().catch(() => ({}));

  try {
    const { code, source } = await generateDiagram({
      type: diagram.type,
      projectId,
      userId: user.id,
      instructions: diagram.instructions ?? undefined,
      repair:
        typeof error === "string" && error
          ? { code: diagram.code, error }
          : undefined,
    });
    const updated = await tursoDb.diagram.update({
      where: { id: diagramId },
      data: { code, source },
    });
    return NextResponse.json({ diagram: updated });
  } catch (err) {
    if (err instanceof DiagramGenerationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Erro ao regenerar diagrama:", err);
    return NextResponse.json({ error: "Erro ao gerar o diagrama" }, { status: 500 });
  }
}
