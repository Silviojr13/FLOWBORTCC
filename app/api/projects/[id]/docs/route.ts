import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";
import { loadSettings, settingsView } from "@/lib/docs-server";
import { DOC_TYPES, type DocSummary } from "@/lib/docs";

type Params = { params: Promise<{ id: string }> };

// GET: os documentos do projeto (quanto de cada um já foi escrito) e as diretrizes.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

  const [rows, settings] = await Promise.all([
    tursoDb.projectDocument.findMany({ where: { projectId }, select: { type: true, version: true, sections: true, updatedAt: true } }),
    loadSettings(projectId),
  ]);
  const byType = new Map(rows.map((r) => [r.type, r]));

  const documents: DocSummary[] = DOC_TYPES.map((def) => {
    const row = byType.get(def.key);
    let stored: Record<string, { content?: string }> = {};
    try {
      stored = row ? JSON.parse(row.sections) : {};
    } catch {
      stored = {};
    }
    const textSections = def.sections.filter((s) => s.kind === "ia");
    return {
      type: def.key,
      title: def.title,
      standard: def.standard,
      version: row?.version ?? "0.1",
      written: textSections.filter((s) => stored[s.key]?.content).length,
      total: textSections.length,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });

  return NextResponse.json({ documents, settings: settingsView(settings), canEdit: gate.access.canEdit.projeto });
}
