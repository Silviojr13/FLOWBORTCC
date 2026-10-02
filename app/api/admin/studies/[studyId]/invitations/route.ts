import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { isAdmin, normalizeEmail } from "@/lib/study-server";

type Params = { params: Promise<{ studyId: string }> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function guard() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Acesso restrito ao admin" }, { status: 403 });
  return null;
}

type InvitationRow = {
  id: string;
  email: string;
  invitedAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
};

/**
 * Indica se já existe conta para cada e-mail convidado. A consulta usa só os e-mails que
 * o próprio admin digitou: o FlowBot nunca lista nem sugere as contas cadastradas.
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

// GET: convites por e-mail desta avaliação.
export async function GET(_req: NextRequest, { params }: Params) {
  const denied = await guard();
  if (denied) return denied;
  const { studyId } = await params;

  const invitations = await tursoDb.studyInvitation.findMany({
    where: { studyId },
    orderBy: { invitedAt: "desc" },
  });
  return NextResponse.json({ invitations: await describe(invitations) });
}

// POST: convida um e-mail exato. Convidar de novo um e-mail que recusou reabre o convite.
export async function POST(req: NextRequest, { params }: Params) {
  const denied = await guard();
  if (denied) return denied;
  const { studyId } = await params;

  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const study = await tursoDb.study.findUnique({ where: { id: studyId }, select: { status: true } });
  if (!study) return NextResponse.json({ error: "Avaliação não encontrada" }, { status: 404 });
  if (study.status !== "aberta") {
    return NextResponse.json({ error: "Reabra a avaliação para convidar pessoas." }, { status: 409 });
  }

  const normalized = normalizeEmail(email);
  const invitation = await tursoDb.studyInvitation.upsert({
    where: { studyId_email: { studyId, email: normalized } },
    create: { studyId, email: normalized },
    update: { declinedAt: null },
  });
  const [result] = await describe([invitation]);
  return NextResponse.json({ invitation: result }, { status: 201 });
}
