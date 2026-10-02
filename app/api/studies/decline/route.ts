import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { settleEmailInvitation } from "@/lib/study-server";

// POST: a pessoa recusa o convite por e-mail; ele deixa de aparecer para ela.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const { code } = await req.json().catch(() => ({}));
  const study = typeof code === "string" ? await tursoDb.study.findUnique({ where: { inviteCode: code } }) : null;
  if (!study) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });

  await settleEmailInvitation(study.id, user.id, "declined");
  return NextResponse.json({ declined: true });
}
