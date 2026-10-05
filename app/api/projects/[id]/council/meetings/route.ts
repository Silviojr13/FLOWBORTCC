import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";
import { loadMeeting, meetingView, memberLabels, type CouncilSnapshot } from "@/lib/council-server";
import { isCouncilRole, MAX_COUNCIL_ROUNDS, MIN_COUNCIL_MEMBERS } from "@/lib/council";

type Params = { params: Promise<{ id: string }> };

// POST: abre uma reunião com os membros atuais do conselho desta pessoa. As falas vêm depois,
// uma por chamada (rota next).
export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { edit: "assistente" });
  if (gate instanceof Response) return gate;
  const userId = gate.user.id;

  const body = await req.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 300) : "";
  const rounds = Number(body.rounds);
  if (!topic) return NextResponse.json({ error: "Escreva o tema da reunião." }, { status: 400 });
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > MAX_COUNCIL_ROUNDS) {
    return NextResponse.json({ error: `Escolha de 1 a ${MAX_COUNCIL_ROUNDS} rodadas.` }, { status: 400 });
  }

  const members = await tursoDb.aiCouncilMember.findMany({
    where: { projectId, userId },
    orderBy: { order: "asc" },
    select: { name: true, role: true, instructions: true, keyId: true },
  });
  if (members.length < MIN_COUNCIL_MEMBERS) {
    return NextResponse.json({ error: `Salve ao menos ${MIN_COUNCIL_MEMBERS} membros no conselho.` }, { status: 400 });
  }

  const labels = await memberLabels(userId, members.map((m) => m.keyId));
  const snapshot: CouncilSnapshot[] = members.map((m) => ({
    name: m.name,
    role: isCouncilRole(m.role) ? m.role : "personalizado",
    instructions: m.instructions,
    keyId: m.keyId,
    label: labels.get(m.keyId) ?? "IA gratuita do FlowBot",
  }));

  const created = await tursoDb.aiCouncilMeeting.create({
    data: { projectId, userId, topic, rounds, members: JSON.stringify(snapshot) },
    select: { id: true },
  });
  const meeting = await loadMeeting(projectId, created.id);
  return NextResponse.json({ meeting: await meetingView(meeting!, userId) }, { status: 201 });
}
