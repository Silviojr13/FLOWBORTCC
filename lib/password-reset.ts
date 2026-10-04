import { createHash, randomBytes } from "crypto";
import { tursoDb } from "./turso-db";
import { sendMail } from "./mailer";

/**
 * Recuperação de senha por e-mail.
 *
 * - O link leva um token aleatório de 256 bits; o banco guarda só o hash SHA-256.
 * - Vale 1 hora e um único uso; pedir de novo invalida os links anteriores.
 * - A resposta ao pedido é sempre a mesma, exista a conta ou não, para o formulário não
 *   revelar quais e-mails estão cadastrados.
 * - Contas criadas com o Google também recebem o link: confirmado o acesso ao e-mail, a
 *   pessoa pode definir uma senha e passar a entrar dos dois jeitos.
 */

export const RESET_TTL_MINUTES = 60;
const MAX_REQUESTS_PER_WINDOW = 3;
const REQUEST_WINDOW_MINUTES = 15;
export const MIN_PASSWORD_LENGTH = 8;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > 128) return "A senha pode ter no máximo 128 caracteres.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use letras e números na senha.";
  }
  return null;
}

function findUserByEmail(email: string) {
  const typed = email.trim();
  return tursoDb.user.findFirst({
    where: { OR: [{ email: typed }, { email: typed.toLowerCase() }] },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      accounts: { select: { provider: true } },
    },
  });
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function buildEmail(params: { name: string | null; link: string; googleOnly: boolean }) {
  const greeting = params.name ? `Olá, ${params.name.split(" ")[0]}!` : "Olá!";
  const googleNote = params.googleOnly
    ? "Sua conta foi criada com o Google, então você pode continuar entrando pelo botão “Continuar com Google”. Se preferir, use o link abaixo para definir uma senha e entrar também com e-mail e senha."
    : "Recebemos um pedido para redefinir a senha da sua conta no FlowBot. Para criar uma nova senha, use o link abaixo.";

  const text = [
    greeting,
    "",
    googleNote,
    "",
    params.link,
    "",
    `O link vale por ${RESET_TTL_MINUTES} minutos e só pode ser usado uma vez.`,
    "Se você não pediu isso, ignore este e-mail: sua senha continua a mesma.",
    "",
    "FlowBot · Gestão de projetos de robótica e sistemas embarcados",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f3f6fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e3e8f0;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0 0 18px;font-size:20px;font-weight:700;letter-spacing:.06em;color:#1d4ed8;">FLOWBOT</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">Redefinição de senha</h1>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(googleNote)}</p>
      <a href="${params.link}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">${params.googleOnly ? "Definir uma senha" : "Criar nova senha"}</a>
      <p style="margin:22px 0 6px;font-size:13px;line-height:1.6;color:#6b7280;">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
      <p style="margin:0 0 22px;font-size:13px;line-height:1.5;word-break:break-all;color:#1d4ed8;">${params.link}</p>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#6b7280;">O link vale por ${RESET_TTL_MINUTES} minutos e só pode ser usado uma vez.</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#6b7280;">Se você não pediu isso, ignore este e-mail: sua senha continua a mesma.</p>
    </td></tr>
    <tr><td style="padding:14px 28px;border-top:1px solid #eef1f6;font-size:12px;color:#9ca3af;">FlowBot · Gestão de projetos de robótica e sistemas embarcados</td></tr>
  </table>
</body>
</html>`;

  return { text, html };
}

/**
 * Cria um link de recuperação e envia por e-mail. Não revela se a conta existe: quem chama
 * responde sempre a mesma mensagem.
 */
export async function requestPasswordReset(email: string, origin: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user?.email) return;

  // Limite de pedidos por conta, contra abuso do envio de e-mails.
  const recent = await tursoDb.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - REQUEST_WINDOW_MINUTES * 60_000) } },
  });
  if (recent >= MAX_REQUESTS_PER_WINDOW) return;

  // Só o link mais recente vale.
  await tursoDb.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  const token = randomBytes(32).toString("base64url");
  await tursoDb.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
    },
  });

  const link = `${origin}/redefinir-senha?token=${token}`;
  const googleOnly = !user.password && user.accounts.some((a) => a.provider === "google");
  const { text, html } = buildEmail({ name: user.name, link, googleOnly });

  await sendMail({ to: user.email, subject: "Redefinição de senha · FlowBot", text, html });
}

/** Valida o token do link. Devolve a conta, ou null se o link for inválido, usado ou vencido. */
export async function findValidResetToken(token: string) {
  if (!token || token.length > 200) return null;
  const record = await tursoDb.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, password: true } } },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) return null;
  return record;
}

/** Mostra o e-mail parcialmente na tela de nova senha (ex.: en***@gmail.com). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}
