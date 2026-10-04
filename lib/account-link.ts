import { randomBytes } from "crypto";
import { compare } from "bcrypt";
import { tursoDb } from "./turso-db";
import { hashToken } from "./password-reset";

/**
 * Associação entre o login com Google e uma conta já criada com e-mail e senha.
 *
 * Quando alguém entra com o Google usando um e-mail que já tem conta manual, o login é
 * desviado para /vincular-conta. A associação só acontece depois que a pessoa confirma a
 * senha da conta existente: o cadastro manual não verifica o e-mail, então juntar as contas
 * sem essa prova permitiria que um terceiro que criou a conta com o e-mail de outra pessoa
 * continuasse com acesso a ela.
 */

const PENDING_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function findUserByEmail(email: string) {
  const typed = email.trim();
  return tursoDb.user.findFirst({
    where: { OR: [{ email: typed }, { email: typed.toLowerCase() }] },
    select: { id: true, email: true, password: true },
  });
}

/**
 * Decide o que fazer com um login pelo Google. Devolve null para seguir com o login normal
 * ou o caminho da tela de associação.
 */
export async function routeGoogleSignIn(params: {
  email: string | null | undefined;
  emailVerified: boolean;
  providerAccountId: string;
  type: string;
}): Promise<string | null> {
  // Google já associado a uma conta: login normal.
  const linked = await tursoDb.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: params.providerAccountId } },
    select: { id: true },
  });
  if (linked || !params.email) return null;

  // E-mail sem conta: o Google cria uma conta nova normalmente.
  const existing = await findUserByEmail(params.email);
  if (!existing?.email) return null;

  if (!params.emailVerified) return "/login?error=GoogleEmailNaoVerificado";

  await tursoDb.pendingAccountLink.deleteMany({
    where: { OR: [{ email: existing.email }, { expiresAt: { lt: new Date() } }] },
  });
  const token = randomBytes(32).toString("base64url");
  await tursoDb.pendingAccountLink.create({
    data: {
      tokenHash: hashToken(token),
      email: existing.email,
      provider: "google",
      providerAccountId: params.providerAccountId,
      type: params.type,
      expiresAt: new Date(Date.now() + PENDING_TTL_MINUTES * 60_000),
    },
  });
  return `/vincular-conta?token=${token}`;
}

export async function findPendingLink(token: string) {
  if (!token || token.length > 200) return null;
  const pending = await tursoDb.pendingAccountLink.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!pending || pending.expiresAt.getTime() < Date.now()) return null;
  const user = await findUserByEmail(pending.email);
  if (!user) return null;
  return { pending, user };
}

export type LinkResult =
  | { ok: true; email: string }
  | { ok: false; status: number; error: string };

/** Confere a senha da conta existente e associa o Google a ela. */
export async function completeAccountLink(token: string, password: string): Promise<LinkResult> {
  const found = await findPendingLink(token);
  if (!found) {
    return { ok: false, status: 410, error: "Este pedido expirou. Entre com o Google de novo para recomeçar." };
  }
  const { pending, user } = found;

  if (!user.password) {
    return { ok: false, status: 409, error: "Esta conta ainda não tem senha. Use “Esqueci minha senha” para criar uma." };
  }
  if (!(await compare(password, user.password))) {
    const updated = await tursoDb.pendingAccountLink.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
    if (updated.attempts >= MAX_ATTEMPTS) {
      await tursoDb.pendingAccountLink.delete({ where: { id: pending.id } });
      return { ok: false, status: 410, error: "Muitas tentativas. Entre com o Google de novo para recomeçar." };
    }
    return { ok: false, status: 401, error: "Senha incorreta." };
  }

  await tursoDb.account.upsert({
    where: { provider_providerAccountId: { provider: pending.provider, providerAccountId: pending.providerAccountId } },
    create: {
      userId: user.id,
      type: pending.type,
      provider: pending.provider,
      providerAccountId: pending.providerAccountId,
    },
    update: {},
  });
  await tursoDb.pendingAccountLink.delete({ where: { id: pending.id } });

  return { ok: true, email: user.email! };
}
