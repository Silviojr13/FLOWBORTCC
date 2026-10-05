import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { acceptInvitation, declineInvitation, describeInvitation } from "@/lib/project-sharing";

type Params = { params: Promise<{ code: string }> };

// GET: o convite como a pessoa logada o vê (aberto, encerrado, para outra conta ou já membro).
export async function GET(_req: NextRequest, { params }: Params) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const invitation = await describeInvitation(code, user);
  if (!invitation) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  return NextResponse.json({ invitation });
}

// POST { action: "aceitar" | "recusar" }
export async function POST(req: NextRequest, { params }: Params) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const { action } = await req.json().catch(() => ({}));
  if (action !== "aceitar" && action !== "recusar") {
    return NextResponse.json({ error: "Ação inválida (aceitar ou recusar)." }, { status: 400 });
  }

  const result = action === "aceitar" ? await acceptInvitation(code, user) : await declineInvitation(code, user);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ projectId: result.projectId });
}
