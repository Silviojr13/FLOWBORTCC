import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findEmailInvite, findInvite, isAdmin, loadParticipation } from "@/lib/study-server";
import type { StudyMe } from "@/lib/study";

// GET: papel do usuário, participação ativa em avaliação e o convite pendente, vindo do
// link (?invite=<código>) ou de um convite enviado pelo admin para o e-mail da conta.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const [admin, participation] = await Promise.all([isAdmin(user.id), loadParticipation(user.id)]);

  let invite = null;
  if (!participation) {
    const code = req.nextUrl.searchParams.get("invite");
    const fromLink = code ? await findInvite(code) : null;
    invite = fromLink && fromLink.status === "aberta" ? fromLink : await findEmailInvite(user.id);
  }

  const body: StudyMe = { isAdmin: admin, participation, invite };
  return NextResponse.json(body);
}
