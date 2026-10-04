import { NextRequest, NextResponse } from "next/server";
import { completeAccountLink, findPendingLink } from "@/lib/account-link";
import { maskEmail } from "@/lib/password-reset";

const EXPIRED = "Este pedido expirou. Entre com o Google de novo para recomeçar.";

// GET ?token=: dados para a tela de associação (e-mail mascarado e se a conta tem senha).
export async function GET(req: NextRequest) {
  const found = await findPendingLink(req.nextUrl.searchParams.get("token") ?? "");
  if (!found?.user.email) return NextResponse.json({ valid: false, error: EXPIRED }, { status: 410 });
  return NextResponse.json({
    valid: true,
    email: maskEmail(found.user.email),
    hasPassword: Boolean(found.user.password),
  });
}

// POST { token, password }: confirma a senha da conta existente e associa o Google.
export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Informe a senha da sua conta." }, { status: 400 });
  }

  const result = await completeAccountLink(token, password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  // O e-mail completo só volta depois da senha conferida: a tela usa para entrar em seguida.
  return NextResponse.json({ linked: true, email: result.email });
}
