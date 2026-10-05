import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { projectInviteUrl } from "@/lib/project-sharing";
import { SITE_URL } from "@/lib/site";
import { tursoDb } from "@/lib/turso-db";

// GET: pessoas do projeto. Quem gerencia vê também e-mails, convites pendentes e o link;
// os demais membros veem só nome e cargo de cada um.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;
  const { access, user } = gate;

  const project = await tursoDb.project.findUnique({
    where: { id: projectId },
    select: {
      user: { select: { id: true, name: true, email: true, image: true } },
      members: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          canSeeCosts: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });

  const manage = access.canManagePeople;
  const owner = {
    name: project.user.name,
    image: project.user.image,
    email: manage ? project.user.email : null,
    isYou: project.user.id === user.id,
  };
  const members = project.members.map((m) => ({
    id: m.id,
    name: m.user.name,
    image: m.user.image,
    role: m.role,
    email: manage ? m.user.email : null,
    canSeeCosts: manage ? m.canSeeCosts : undefined,
    joinedAt: m.createdAt.toISOString(),
    isYou: m.user.id === user.id,
  }));

  if (!manage) return NextResponse.json({ owner, members, canManagePeople: false });

  const now = new Date();
  const invitations = await tursoDb.projectInvitation.findMany({
    where: { projectId, revokedAt: null, acceptedAt: null, declinedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, email: true, createdAt: true, expiresAt: true },
  });
  const origin = process.env.NODE_ENV === "production" ? SITE_URL : req.nextUrl.origin;
  const link = invitations.find((i) => !i.email);

  return NextResponse.json({
    owner,
    members,
    canManagePeople: true,
    invitations: invitations
      .filter((i) => i.email)
      .map((i) => ({ id: i.id, email: i.email, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString() })),
    link: link
      ? { id: link.id, url: projectInviteUrl(origin, link.code), expiresAt: link.expiresAt.toISOString() }
      : null,
  });
}
