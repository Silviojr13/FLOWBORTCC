import { randomBytes } from "crypto";
import { sendMail } from "./mailer";
import { normalizeEmail } from "./study-server";
import { tursoDb } from "./turso-db";

/**
 * Convites para projetos. Quem aceita entra como visitante (só leitura); o dono ou um gestor
 * muda o cargo depois. O convite por e-mail vale para aquela conta e uma vez; o por link vale
 * para qualquer conta até expirar ou ser revogado.
 */

export const EMAIL_INVITE_DAYS = 14;
export const LINK_INVITE_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Código longo: quem tem o link entra no projeto. */
export function newShareCode(): string {
  return randomBytes(18).toString("base64url");
}

export function inviteExpiry(kind: "email" | "link"): Date {
  return new Date(Date.now() + (kind === "email" ? EMAIL_INVITE_DAYS : LINK_INVITE_DAYS) * DAY);
}

/** Endereço do convite: domínio publicado em produção, servidor local em desenvolvimento. */
export function projectInviteUrl(origin: string, code: string): string {
  return `${origin}/convite/${code}`;
}

type Invitation = NonNullable<Awaited<ReturnType<typeof findInvitation>>>;

export async function findInvitation(code: string) {
  if (!code || code.length > 100) return null;
  return tursoDb.projectInvitation.findUnique({
    where: { code },
    include: { project: { select: { id: true, name: true, userId: true, user: { select: { name: true } } } } },
  });
}

export function isInvitationOpen(invitation: Invitation): boolean {
  return (
    !invitation.revokedAt &&
    !invitation.acceptedAt &&
    !invitation.declinedAt &&
    invitation.expiresAt.getTime() > Date.now()
  );
}

/** Esconde parte do e-mail: "ma***@gmail.com". */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

export type InvitationView = {
  code: string;
  projectId: string;
  projectName: string;
  ownerName: string | null;
  kind: "email" | "link";
  status: "aberto" | "encerrado" | "outra-conta" | "membro";
  /** Para quem foi o convite por e-mail, mascarado. */
  sentTo: string | null;
};

/** Como o convite aparece para quem o abre, considerando a conta logada (se houver). */
export async function describeInvitation(
  code: string,
  user: { id: string; email: string | null } | null
): Promise<InvitationView | null> {
  const invitation = await findInvitation(code);
  if (!invitation) return null;

  let status: InvitationView["status"] = isInvitationOpen(invitation) ? "aberto" : "encerrado";
  if (user) {
    const member =
      invitation.project.userId === user.id ||
      (await tursoDb.projectMember.findUnique({
        where: { projectId_userId: { projectId: invitation.projectId, userId: user.id } },
        select: { id: true },
      }));
    if (member) status = "membro";
    else if (
      status === "aberto" &&
      invitation.email &&
      normalizeEmail(user.email ?? "") !== invitation.email
    ) {
      status = "outra-conta";
    }
  }

  return {
    code: invitation.code,
    projectId: invitation.projectId,
    projectName: invitation.project.name,
    ownerName: invitation.project.user.name,
    kind: invitation.email ? "email" : "link",
    status,
    sentTo: invitation.email ? maskEmail(invitation.email) : null,
  };
}

export type InvitationResult = { ok: true; projectId: string } | { ok: false; status: number; error: string };

/** Aceita o convite: a pessoa vira visitante do projeto. Aceitar de novo não muda o cargo. */
export async function acceptInvitation(
  code: string,
  user: { id: string; email: string | null }
): Promise<InvitationResult> {
  const invitation = await findInvitation(code);
  if (!invitation) return { ok: false, status: 404, error: "Convite não encontrado." };

  const projectId = invitation.projectId;
  if (invitation.project.userId === user.id) return { ok: true, projectId };
  const existing = await tursoDb.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { id: true },
  });
  if (existing) return { ok: true, projectId };

  if (!isInvitationOpen(invitation)) {
    return { ok: false, status: 410, error: "Este convite não vale mais. Peça um novo a quem compartilhou o projeto." };
  }
  if (invitation.email && normalizeEmail(user.email ?? "") !== invitation.email) {
    return {
      ok: false,
      status: 403,
      error: `Este convite foi enviado para ${maskEmail(invitation.email)}. Entre com essa conta para aceitar.`,
    };
  }

  await tursoDb.$transaction([
    tursoDb.projectMember.create({ data: { projectId, userId: user.id, role: "visitante" } }),
    ...(invitation.email
      ? [tursoDb.projectInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } })]
      : []),
  ]);
  return { ok: true, projectId };
}

export async function declineInvitation(
  code: string,
  user: { id: string; email: string | null }
): Promise<InvitationResult> {
  const invitation = await findInvitation(code);
  if (!invitation || !invitation.email || normalizeEmail(user.email ?? "") !== invitation.email) {
    return { ok: false, status: 404, error: "Convite não encontrado." };
  }
  if (isInvitationOpen(invitation)) {
    await tursoDb.projectInvitation.update({ where: { id: invitation.id }, data: { declinedAt: new Date() } });
  }
  return { ok: true, projectId: invitation.projectId };
}

/** Convites por e-mail ainda abertos para a conta, de projetos em que ela não está. */
export async function pendingInvitationsFor(user: { id: string; email: string | null }) {
  if (!user.email) return [];
  const invitations = await tursoDb.projectInvitation.findMany({
    where: {
      email: normalizeEmail(user.email),
      revokedAt: null,
      acceptedAt: null,
      declinedAt: null,
      expiresAt: { gt: new Date() },
      project: { userId: { not: user.id }, members: { none: { userId: user.id } } },
    },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { id: true, name: true, user: { select: { name: true } } } } },
  });
  return invitations.map((i) => ({
    code: i.code,
    projectId: i.project.id,
    projectName: i.project.name,
    ownerName: i.project.user.name,
    createdAt: i.createdAt.toISOString(),
  }));
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendInvitationEmail(params: {
  to: string;
  inviterName: string | null;
  projectName: string;
  link: string;
}) {
  const who = params.inviterName?.trim() || "Uma pessoa";
  const lead = `${who} convidou você para acompanhar o projeto “${params.projectName}” no FlowBot.`;
  const role =
    "Você entra como visitante: vê o andamento, as tarefas e os relatórios, sem editar nada. Quem compartilhou pode mudar seu cargo depois.";

  const text = [
    "Olá!",
    "",
    lead,
    role,
    "",
    params.link,
    "",
    `O convite vale por ${EMAIL_INVITE_DAYS} dias. Se não reconhece quem convidou, ignore este e-mail.`,
    "",
    "FlowBot · Gestão de projetos de robótica e sistemas embarcados",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f3f6fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e3e8f0;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0 0 18px;font-size:20px;font-weight:700;letter-spacing:.06em;color:#1d4ed8;">FLOWBOT</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">Convite para um projeto</h1>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">${escapeHtml(lead)}</p>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(role)}</p>
      <a href="${params.link}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">Ver o convite</a>
      <p style="margin:22px 0 6px;font-size:13px;line-height:1.6;color:#6b7280;">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
      <p style="margin:0 0 22px;font-size:13px;line-height:1.5;word-break:break-all;color:#1d4ed8;">${params.link}</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#6b7280;">O convite vale por ${EMAIL_INVITE_DAYS} dias. Se não reconhece quem convidou, ignore este e-mail.</p>
    </td></tr>
    <tr><td style="padding:14px 28px;border-top:1px solid #eef1f6;font-size:12px;color:#9ca3af;">FlowBot · Gestão de projetos de robótica e sistemas embarcados</td></tr>
  </table>
</body>
</html>`;

  await sendMail({ to: params.to, subject: `Convite para o projeto “${params.projectName}” · FlowBot`, html, text });
}
