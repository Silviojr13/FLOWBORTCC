import { NextRequest, NextResponse, after } from "next/server";
import { requestPasswordReset, RESET_TTL_MINUTES } from "@/lib/password-reset";
import { SITE_URL } from "@/lib/site";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST: pede o link de recuperação. A resposta é sempre a mesma, exista a conta ou não, e
// o envio acontece depois da resposta (after) para o tempo também não denunciar a conta.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  // Em produção o link usa sempre o domínio publicado; em desenvolvimento, o servidor local.
  const origin = process.env.NODE_ENV === "production" ? SITE_URL : req.nextUrl.origin;

  after(async () => {
    try {
      await requestPasswordReset(email, origin);
    } catch (error) {
      console.error("Erro ao enviar o e-mail de recuperação de senha:", error);
    }
  });

  return NextResponse.json({
    message: `Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale por ${RESET_TTL_MINUTES} minutos.`,
  });
}
