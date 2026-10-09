import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { authorizeProject } from "./project-access";
import { tursoDb } from "./turso-db";
import { DEFAULT_STUDY } from "./study";
import { buildStudyResults } from "./study-results";
import { isAdmin, newInviteCode, normalizeEmail } from "./study-server";

/**
 * Gestão das avaliações de usabilidade (SUS), compartilhada pela tela do admin
 * (/api/admin/studies) e pela aba Avaliação do projeto (/api/projects/[id]/studies).
 * As rotas só escolhem quem pode entrar; a regra de cada operação fica aqui.
 */

type Denied = Response;
const deny = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Admin do sistema: vê e gerencia todas as avaliações. */
export async function adminGuard(): Promise<{ userId: string } | Denied> {
  const user = await getCurrentUser();
  if (!user) return deny("Usuário não autenticado", 401);
  if (!(await isAdmin(user.id))) return deny("Acesso restrito ao admin", 403);
  return { userId: user.id };
}

/**
 * Dono e gestores do projeto: gerenciam as avaliações dele. Os outros cargos não acessam:
 * as respostas são dados pessoais dos participantes. Com studyId, confere que a avaliação
 * é deste projeto.
 */
export async function projectStudyGuard(projectId: string, studyId?: string): Promise<{ userId: string } | Denied> {
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;
  if (gate.access.role !== "dono" && gate.access.role !== "gestor") {
    return deny("Só o dono e os gestores do projeto acessam a avaliação.", 403);
  }
  if (studyId) {
    const study = await tursoDb.study.findFirst({ where: { id: studyId, projectId }, select: { id: true } });
    if (!study) return deny("Avaliação não encontrada", 404);
  }
  return { userId: gate.user.id };
}

export async function listStudies(projectId?: string) {
  const studies = await tursoDb.study.findMany({
    where: projectId ? { projectId } : {},
    orderBy: { createdAt: "desc" },
    include: { participants: { select: { submittedAt: true } } },
  });
  return studies.map(({ participants, ...s }) => ({
    ...s,
    joined: participants.length,
    submitted: participants.filter((p) => p.submittedAt).length,
  }));
}

export function createStudy(userId: string, title: unknown, projectId?: string) {
  return tursoDb.study.create({
    data: {
      title: typeof title === "string" && title.trim() ? title.trim().slice(0, 120) : DEFAULT_STUDY.title,
      intro: DEFAULT_STUDY.intro,
      privacy: DEFAULT_STUDY.privacy,
      contact: DEFAULT_STUDY.contact,
      inviteCode: newInviteCode(),
      createdById: userId,
      projectId: projectId ?? null,
    },
  });
}

export async function studyDetailResponse(studyId: string) {
  const study = await tursoDb.study.findUnique({ where: { id: studyId } });
  if (!study) return deny("Avaliação não encontrada", 404);
  return NextResponse.json({ study, results: await buildStudyResults(studyId) });
}

/** Textos exibidos ao participante e status (aberta/encerrada). */
export async function updateStudyResponse(studyId: string, body: Record<string, unknown>) {
  const data: Record<string, string | null> = {};
  for (const [field, max] of [["title", 120], ["intro", 4000], ["privacy", 4000]] as const) {
    const value = body[field];
    if (typeof value === "string" && value.trim()) data[field] = value.trim().slice(0, max);
  }
  if (typeof body.contact === "string") data.contact = body.contact.trim().slice(0, 300) || null;
  if (body.status === "aberta" || body.status === "encerrada") data.status = body.status;

  const exists = await tursoDb.study.findUnique({ where: { id: studyId }, select: { id: true } });
  if (!exists) return deny("Avaliação não encontrada", 404);
  const study = await tursoDb.study.update({ where: { id: studyId }, data });
  return NextResponse.json({ study });
}

/** Exclui a avaliação com participações e respostas (as contas não são afetadas). */
export async function deleteStudyResponse(studyId: string) {
  const removed = await tursoDb.study.deleteMany({ where: { id: studyId } });
  if (removed.count === 0) return deny("Avaliação não encontrada", 404);
  return NextResponse.json({ deleted: true });
}

/* ---------------------------------------------------------------- convites por e-mail */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InvitationRow = {
  id: string;
  email: string;
  invitedAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
};

/**
 * Indica se já existe conta para cada e-mail convidado. A consulta usa só os e-mails que
 * quem gerencia digitou: o FlowBot nunca lista nem sugere as contas cadastradas.
 */
async function describe(invitations: InvitationRow[]) {
  const accounts = await tursoDb.user.findMany({
    where: { email: { in: invitations.map((i) => i.email) } },
    select: { email: true },
  });
  const registered = new Set(accounts.map((a) => a.email?.toLowerCase()));
  return invitations.map((i) => ({
    id: i.id,
    email: i.email,
    invitedAt: i.invitedAt.toISOString(),
    status: i.acceptedAt ? "aceito" : i.declinedAt ? "recusado" : "pendente",
    hasAccount: registered.has(i.email),
  }));
}

export async function listInvitationsResponse(studyId: string) {
  const invitations = await tursoDb.studyInvitation.findMany({
    where: { studyId },
    orderBy: { invitedAt: "desc" },
  });
  return NextResponse.json({ invitations: await describe(invitations) });
}

/** Convida um e-mail exato. Convidar de novo um e-mail que recusou reabre o convite. */
export async function inviteResponse(studyId: string, email: unknown) {
  if (typeof email !== "string" || !EMAIL.test(email.trim())) return deny("Informe um e-mail válido.", 400);

  const study = await tursoDb.study.findUnique({ where: { id: studyId }, select: { status: true } });
  if (!study) return deny("Avaliação não encontrada", 404);
  if (study.status !== "aberta") return deny("Reabra a avaliação para convidar pessoas.", 409);

  const normalized = normalizeEmail(email);
  const invitation = await tursoDb.studyInvitation.upsert({
    where: { studyId_email: { studyId, email: normalized } },
    create: { studyId, email: normalized },
    update: { declinedAt: null },
  });
  const [result] = await describe([invitation]);
  return NextResponse.json({ invitation: result }, { status: 201 });
}

/** Cancela um convite que ainda não foi aceito. */
export async function cancelInvitationResponse(studyId: string, invitationId: string) {
  const removed = await tursoDb.studyInvitation.deleteMany({ where: { id: invitationId, studyId, acceptedAt: null } });
  if (removed.count === 0) return deny("Convite não encontrado ou já aceito.", 404);
  return NextResponse.json({ deleted: true });
}

/**
 * Remove uma participação (ex.: testes da equipe antes da validação). Os projetos da conta
 * não são afetados; só o progresso e as respostas desta avaliação.
 */
export async function removeParticipantResponse(studyId: string, participantId: string) {
  const removed = await tursoDb.studyParticipant.deleteMany({ where: { id: participantId, studyId } });
  if (removed.count === 0) return deny("Participação não encontrada", 404);
  return NextResponse.json({ deleted: true });
}
