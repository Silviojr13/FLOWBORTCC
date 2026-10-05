import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { buildDocView, docOrFail, DocsError, loadSettings, publishVersion, saveSection, settingsView } from "@/lib/docs-server";

type Params = { params: Promise<{ id: string; type: string }> };

// GET: o documento com as seções (as de dados e de diagrama montadas na hora) e as diretrizes.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId, type } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

  try {
    const def = docOrFail(type);
    const [document, settings] = await Promise.all([
      buildDocView(projectId, def, !gate.access.canSeeCosts),
      loadSettings(projectId),
    ]);
    return NextResponse.json({ document, settings: settingsView(settings), canEdit: gate.access.canEdit.projeto });
  } catch (error) {
    if (error instanceof DocsError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

// PATCH: { sectionKey, content } edita uma seção de texto à mão; { publish: nota } fecha uma
// nova versão do documento no histórico de revisões.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: projectId, type } = await params;
  const gate = await authorizeProject(projectId, { edit: "projeto" });
  if (gate instanceof Response) return gate;

  try {
    const def = docOrFail(type);
    const body = await req.json().catch(() => ({}));

    if (typeof body.publish === "string") {
      const note = body.publish.trim().slice(0, 300);
      if (!note) return NextResponse.json({ error: "Descreva o que mudou nesta versão." }, { status: 400 });
      const version = await publishVersion(projectId, def.key, note, gate.user.name ?? gate.user.email ?? null);
      return NextResponse.json({ version });
    }

    const section = def.sections.find((s) => s.key === body.sectionKey);
    if (!section) return NextResponse.json({ error: "Seção não encontrada." }, { status: 404 });
    if (section.kind !== "ia") {
      return NextResponse.json({ error: "Esta seção vem dos dados do projeto: altere os dados na tela correspondente." }, { status: 400 });
    }
    if (typeof body.content !== "string") return NextResponse.json({ error: "Envie o texto da seção." }, { status: 400 });
    await saveSection(projectId, def.key, section.key, body.content.slice(0, 30000), "manual");
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof DocsError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
