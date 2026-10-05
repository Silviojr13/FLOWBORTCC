import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";
import { clipReference, loadSettings, settingsView } from "@/lib/docs-server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 10 * 1024 * 1024;

/** Texto do modelo de referência: PDF, Word (.docx), Markdown ou texto. */
async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (name.endsWith(".pdf")) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buffer);
    const { text } = await pdfText(pdf, { mergePages: true });
    return text;
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return value;
  }
  if (/\.(md|markdown|txt)$/.test(name)) return new TextDecoder("utf-8").decode(buffer);
  throw new Error("formato");
}

// POST: anexa o modelo de referência (o modelo da instituição, a rubrica ou um exemplo).
// Só o texto fica guardado; a IA segue a estrutura dele ao escrever.
export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { edit: "projeto" });
  if (gate instanceof Response) return gate;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Escolha um arquivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "O arquivo passa de 10 MB." }, { status: 400 });

  let text: string;
  try {
    text = clipReference(await extractText(file));
  } catch (error) {
    const message =
      error instanceof Error && error.message === "formato"
        ? "Use PDF, Word (.docx), Markdown ou texto."
        : "Não foi possível ler o arquivo. Se for um PDF escaneado (imagem), envie a versão em Word ou texto.";
    if (!(error instanceof Error && error.message === "formato")) console.error("Erro ao ler o modelo de referência:", error);
    return NextResponse.json({ error: message }, { status: 422 });
  }
  if (text.length < 40) {
    return NextResponse.json({ error: "Não encontrei texto no arquivo. Se for um PDF escaneado, envie a versão em Word ou texto." }, { status: 422 });
  }

  const data = { referenceName: file.name.slice(0, 120), referenceText: text };
  await tursoDb.projectDocSettings.upsert({ where: { projectId }, create: { projectId, ...data }, update: data });
  return NextResponse.json({ settings: settingsView(await loadSettings(projectId)) });
}

// DELETE: remove o modelo de referência.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { edit: "projeto" });
  if (gate instanceof Response) return gate;

  await tursoDb.projectDocSettings.updateMany({ where: { projectId }, data: { referenceName: null, referenceText: null } });
  return NextResponse.json({ settings: settingsView(await loadSettings(projectId)) });
}
