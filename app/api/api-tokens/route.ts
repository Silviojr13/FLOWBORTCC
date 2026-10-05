import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { generateApiToken } from "@/lib/api-tokens";

export const runtime = "nodejs";

const MAX_TOKENS_PER_USER = 10;
const tokenSelect = { id: true, name: true, tokenHint: true, lastUsedAt: true, createdAt: true } as const;

// GET: tokens pessoais da pessoa (sem o token em si, que só aparece ao ser gerado).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const tokens = await tursoDb.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: tokenSelect,
  });
  return NextResponse.json({ tokens });
}

// POST: gera um token. A resposta traz o token completo uma única vez.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return NextResponse.json({ error: "Dê um nome ao token (ex.: Claude Code do notebook)." }, { status: 400 });

  const count = await tursoDb.apiToken.count({ where: { userId: user.id } });
  if (count >= MAX_TOKENS_PER_USER) {
    return NextResponse.json({ error: `Você pode ter até ${MAX_TOKENS_PER_USER} tokens. Revogue um para gerar outro.` }, { status: 400 });
  }

  const { token, hash, hint } = generateApiToken();
  const created = await tursoDb.apiToken.create({
    data: { userId: user.id, name, tokenHash: hash, tokenHint: hint },
    select: tokenSelect,
  });
  return NextResponse.json({ token: created, secret: token }, { status: 201 });
}
