import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findInvite, isAdmin, loadParticipation } from "@/lib/study-server";
import type { StudyMe } from "@/lib/study";

// GET: papel do usuário, participação ativa em avaliação e, com ?invite=<código>, o convite
// pendente (quando o usuário ainda não participa daquela avaliação).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const [admin, participation] = await Promise.all([isAdmin(user.id), loadParticipation(user.id)]);

  let invite = null;
  const code = req.nextUrl.searchParams.get("invite");
  if (code && !participation) {
    const found = await findInvite(code);
    if (found && found.status === "aberta") invite = found;
  }

  const body: StudyMe = { isAdmin: admin, participation, invite };
  return NextResponse.json(body);
}
