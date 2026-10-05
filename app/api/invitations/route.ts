import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pendingInvitationsFor } from "@/lib/project-sharing";

// GET: convites por e-mail esperando resposta da pessoa logada.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  return NextResponse.json({ invitations: await pendingInvitationsFor(user) });
}
