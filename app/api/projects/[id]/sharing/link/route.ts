import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { inviteExpiry, newShareCode, projectInviteUrl } from "@/lib/project-sharing";
import { SITE_URL } from "@/lib/site";
import { tursoDb } from "@/lib/turso-db";

// POST: cria o link de convite do projeto. Se já houver um, ele é desativado e um novo é
// gerado: assim quem recebeu o link antigo não entra mais.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { managePeople: true });
  if (gate instanceof Response) return gate;

  const [, link] = await tursoDb.$transaction([
    tursoDb.projectInvitation.updateMany({
      where: { projectId, email: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    tursoDb.projectInvitation.create({
      data: { projectId, code: newShareCode(), invitedById: gate.user.id, expiresAt: inviteExpiry("link") },
    }),
  ]);

  const origin = process.env.NODE_ENV === "production" ? SITE_URL : req.nextUrl.origin;
  return NextResponse.json(
    { link: { id: link.id, url: projectInviteUrl(origin, link.code), expiresAt: link.expiresAt.toISOString() } },
    { status: 201 }
  );
}
