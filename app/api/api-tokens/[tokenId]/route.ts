import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";

export const runtime = "nodejs";

type Params = { params: Promise<{ tokenId: string }> };

// DELETE: revoga o token; o Claude Code que o usava perde o acesso na hora.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { tokenId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const { count } = await tursoDb.apiToken.deleteMany({ where: { id: tokenId, userId: user.id } });
  if (count === 0) return NextResponse.json({ error: "Token não encontrado." }, { status: 404 });
  return NextResponse.json({ removed: true });
}
