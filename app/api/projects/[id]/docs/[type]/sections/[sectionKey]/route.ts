import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { friendlyAiError } from "@/lib/ai-client";
import { AI_PROVIDER_INFO } from "@/lib/ai-providers";
import { docOrFail, DocsAiError, DocsError, writeSection } from "@/lib/docs-server";

export const runtime = "nodejs";
// Uma seção por chamada; com uma IA própria o texto pode ser longo.
export const maxDuration = 60;

type Params = { params: Promise<{ id: string; type: string; sectionKey: string }> };

const STATUS_BY_KIND: Partial<Record<string, number>> = { rate: 429, quota: 402 };

function errorResponse(error: unknown): Response {
  if (error instanceof DocsError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof DocsAiError) {
    const { kind, retryAfter } = error.cause;
    const message = friendlyAiError(error.cause, { providerOf: AI_PROVIDER_INFO[error.provider].of, ownKey: error.ownKey });
    return NextResponse.json(
      { error: message, retryAfter: kind === "rate" ? retryAfter : null },
      { status: STATUS_BY_KIND[kind] ?? 502 }
    );
  }
  console.error("Erro ao escrever a seção do documento:", error);
  return NextResponse.json({ error: "Não foi possível escrever a seção agora. Tente de novo." }, { status: 500 });
}

// POST: a IA escreve (ou reescreve) uma seção de texto do documento; { continue: true } segue
// de onde a seção parou no limite de tamanho da IA.
export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId, type, sectionKey } = await params;
  const gate = await authorizeProject(projectId, { edit: "projeto" });
  if (gate instanceof Response) return gate;

  try {
    const def = docOrFail(type);
    const section = def.sections.find((s) => s.key === sectionKey);
    if (!section) return NextResponse.json({ error: "Seção não encontrada." }, { status: 404 });
    if (section.kind !== "ia") {
      return NextResponse.json({ error: "Esta seção vem dos dados do projeto e se atualiza sozinha." }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const instructions = typeof body.instructions === "string" ? body.instructions.trim() || null : null;
    const content = await writeSection(gate.access, gate.user.id, def, section, instructions, body.continue === true ? "continue" : "write");
    return NextResponse.json({ content });
  } catch (error) {
    return errorResponse(error);
  }
}
