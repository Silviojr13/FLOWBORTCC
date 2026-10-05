import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";
import { loadMeeting, meetingView } from "@/lib/council-server";

type Params = { params: Promise<{ id: string; meetingId: string }> };

// GET: a reunião com as falas e a ata.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId, meetingId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

  const meeting = await loadMeeting(projectId, meetingId);
  if (!meeting) return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
  return NextResponse.json({ meeting: await meetingView(meeting, gate.user.id) });
}

// PATCH: guarda o resultado das alterações aplicadas a partir da ata (a proposta não volta
// a aparecer como pendente).
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: projectId, meetingId } = await params;
  const gate = await authorizeProject(projectId, { edit: "assistente" });
  if (gate instanceof Response) return gate;

  const body = await req.json().catch(() => ({}));
  const appliedSummary = typeof body.appliedSummary === "string" ? body.appliedSummary.trim().slice(0, 8000) : "";
  if (!appliedSummary) return NextResponse.json({ error: "Nada para registrar." }, { status: 400 });

  const { count } = await tursoDb.aiCouncilMeeting.updateMany({
    where: { id: meetingId, projectId, userId: gate.user.id, status: "done" },
    data: { appliedSummary },
  });
  if (count === 0) return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
  return NextResponse.json({ saved: true });
}

// DELETE: apaga a reunião. Quem a fez ou quem gerencia o projeto.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: projectId, meetingId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

  const meeting = await tursoDb.aiCouncilMeeting.findFirst({ where: { id: meetingId, projectId }, select: { userId: true } });
  if (!meeting) return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
  if (meeting.userId !== gate.user.id && !gate.access.canManagePeople) {
    return NextResponse.json({ error: "Só quem fez a reunião ou quem gerencia o projeto pode apagá-la." }, { status: 403 });
  }
  await tursoDb.aiCouncilMeeting.delete({ where: { id: meetingId } });
  return NextResponse.json({ removed: true });
}
