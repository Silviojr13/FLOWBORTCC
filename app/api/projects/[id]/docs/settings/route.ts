import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";
import { loadSettings, settingsView } from "@/lib/docs-server";

type Params = { params: Promise<{ id: string }> };

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) || null : null);

// PUT: diretrizes da documentação (entrega acadêmica, instituição, autores e observações).
export async function PUT(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { edit: "projeto" });
  if (gate instanceof Response) return gate;

  const body = await req.json().catch(() => ({}));
  const data = {
    academic: body.academic === true,
    institution: text(body.institution, 120),
    course: text(body.course, 120),
    authors: text(body.authors, 300),
    advisor: text(body.advisor, 120),
    notes: text(body.notes, 1500),
  };
  await tursoDb.projectDocSettings.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });
  return NextResponse.json({ settings: settingsView(await loadSettings(projectId)) });
}
