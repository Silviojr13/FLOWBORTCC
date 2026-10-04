import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcrypt";
import { tursoDb } from "@/lib/turso-db";
import { findValidResetToken, maskEmail, validateNewPassword } from "@/lib/password-reset";

const INVALID_LINK = "Este link de recuperação é inválido ou já expirou. Peça um novo na tela de login.";

// GET ?token=: confere o link antes de mostrar o formulário de nova senha.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const record = await findValidResetToken(token);
  if (!record?.user.email) return NextResponse.json({ valid: false, error: INVALID_LINK }, { status: 410 });

  return NextResponse.json({
    valid: true,
    email: maskEmail(record.user.email),
    hasPassword: Boolean(record.user.password),
  });
}

// POST: define a nova senha e invalida o link (uso único).
export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));
  const record = await findValidResetToken(typeof token === "string" ? token : "");
  if (!record) return NextResponse.json({ error: INVALID_LINK }, { status: 410 });

  const invalid = validateNewPassword(password);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  await tursoDb.user.update({
    where: { id: record.userId },
    data: { password: await hash(password as string, 10) },
  });
  // Este link fica marcado como usado e qualquer outro pendente da conta deixa de valer.
  await tursoDb.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  await tursoDb.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } });

  return NextResponse.json({ message: "Senha alterada. Você já pode entrar com a nova senha." });
}
