import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";
import { memberLabels } from "@/lib/council-server";
import { isCouncilRole, MAX_COUNCIL_MEMBERS, type CouncilMeetingSummary, type CouncilMemberInput } from "@/lib/council";

type Params = { params: Promise<{ id: string }> };

// GET: os membros do conselho desta pessoa neste projeto, as IAs que ela pode usar e as
// reuniões do projeto (quem vê o projeto vê as reuniões).
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;
  const userId = gate.user.id;

  const [members, keys, meetings] = await Promise.all([
    tursoDb.aiCouncilMember.findMany({
      where: { projectId, userId },
      orderBy: { order: "asc" },
      select: { name: true, role: true, instructions: true, keyId: true },
    }),
    tursoDb.userAiKey.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true } }),
    tursoDb.aiCouncilMeeting.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, topic: true, status: true, createdAt: true, userId: true },
    }),
  ]);

  const labels = await memberLabels(userId, keys.map((k) => k.id));
  const runners = await tursoDb.user.findMany({
    where: { id: { in: Array.from(new Set(meetings.map((m) => m.userId))) } },
    select: { id: true, name: true, email: true },
  });
  const runnerName = new Map(runners.map((r) => [r.id, r.name?.trim() || r.email?.split("@")[0] || null]));

  return NextResponse.json({
    members: members.map((m) => ({ ...m, role: isCouncilRole(m.role) ? m.role : "personalizado" })),
    ais: Array.from(labels.entries()).map(([id, label]) => ({ id, label })),
    canRun: gate.access.canEdit.assistente,
    canManage: gate.access.canManagePeople,
    meetings: meetings.map<CouncilMeetingSummary>((m) => ({
      id: m.id,
      topic: m.topic,
      status: m.status === "done" ? "done" : "running",
      createdAt: m.createdAt.toISOString(),
      runner: runnerName.get(m.userId) ?? null,
      isMine: m.userId === userId,
    })),
  });
}

/** Valida um membro vindo da tela: o membro pronto ou a mensagem de erro. */
function parseMember(raw: Record<string, unknown> | null): CouncilMemberInput | string {
  const name = typeof raw?.name === "string" ? raw.name.trim().slice(0, 40) : "";
  if (!raw || !name) return "Todo membro precisa de um nome.";
  if (!isCouncilRole(raw.role)) return `Cargo inválido para ${name}.`;
  const instructions = typeof raw.instructions === "string" ? raw.instructions.trim().slice(0, 500) || null : null;
  if (raw.role === "personalizado" && !instructions) return `Descreva o cargo personalizado de ${name}.`;
  const keyId = typeof raw.keyId === "string" && raw.keyId ? raw.keyId : null;
  return { name, role: raw.role, instructions, keyId };
}

// PUT: troca a lista de membros do conselho desta pessoa (nome, cargo, instruções e IA).
export async function PUT(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { edit: "assistente" });
  if (gate instanceof Response) return gate;
  const userId = gate.user.id;

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.members)) return NextResponse.json({ error: "Envie a lista de membros." }, { status: 400 });
  if (body.members.length > MAX_COUNCIL_MEMBERS) {
    return NextResponse.json({ error: `O conselho tem no máximo ${MAX_COUNCIL_MEMBERS} membros.` }, { status: 400 });
  }

  const members: CouncilMemberInput[] = [];
  for (const raw of body.members as (Record<string, unknown> | null)[]) {
    const member = parseMember(raw);
    if (typeof member === "string") return NextResponse.json({ error: member }, { status: 400 });
    members.push(member);
  }
  if (new Set(members.map((m) => m.name.toLocaleLowerCase("pt-BR"))).size !== members.length) {
    return NextResponse.json({ error: "Dê um nome diferente a cada membro." }, { status: 400 });
  }

  // Só as IAs da própria pessoa.
  const keyIds = Array.from(new Set(members.map((m) => m.keyId).filter((id): id is string => !!id)));
  if (keyIds.length > 0) {
    const owned = await tursoDb.userAiKey.count({ where: { id: { in: keyIds }, userId } });
    if (owned !== keyIds.length) {
      return NextResponse.json({ error: "Uma das IAs escolhidas não está mais conectada em Minhas IAs." }, { status: 400 });
    }
  }

  await tursoDb.$transaction([
    tursoDb.aiCouncilMember.deleteMany({ where: { projectId, userId } }),
    tursoDb.aiCouncilMember.createMany({
      data: members.map((m, order) => ({ ...m, projectId, userId, order })),
    }),
  ]);
  return NextResponse.json({ saved: members.length });
}
