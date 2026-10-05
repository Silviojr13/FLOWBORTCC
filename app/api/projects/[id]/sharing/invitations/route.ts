import { NextRequest, NextResponse, after } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import {
  EMAIL_PATTERN,
  inviteExpiry,
  newShareCode,
  projectInviteUrl,
  sendInvitationEmail,
} from "@/lib/project-sharing";
import { SITE_URL } from "@/lib/site";
import { normalizeEmail } from "@/lib/study-server";
import { tursoDb } from "@/lib/turso-db";

// POST: convida um e-mail exato. A resposta é a mesma exista a conta ou não (ninguém lista
// quem está cadastrado); quem ainda não tem conta cria uma e encontra o convite ao entrar.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { managePeople: true });
  if (gate instanceof Response) return gate;

  const { email: raw } = await req.json().catch(() => ({}));
  if (typeof raw !== "string" || !EMAIL_PATTERN.test(raw.trim())) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  const email = normalizeEmail(raw);

  const project = await tursoDb.project.findUnique({
    where: { id: projectId },
    select: { name: true, user: { select: { email: true } } },
  });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });

  if (project.user.email && normalizeEmail(project.user.email) === email) {
    return NextResponse.json({ error: "Este e-mail é do dono do projeto." }, { status: 400 });
  }
  const alreadyMember = await tursoDb.projectMember.findFirst({
    where: { projectId, user: { email: { in: [email, raw.trim()] } } },
    select: { id: true },
  });
  if (alreadyMember) {
    return NextResponse.json({ error: "Esta pessoa já participa do projeto." }, { status: 409 });
  }

  // Convidar de novo o mesmo e-mail renova o convite aberto em vez de criar outro.
  const open = await tursoDb.projectInvitation.findFirst({
    where: { projectId, email, revokedAt: null, acceptedAt: null, declinedAt: null },
    select: { id: true },
  });
  const invitation = open
    ? await tursoDb.projectInvitation.update({
        where: { id: open.id },
        data: { expiresAt: inviteExpiry("email") },
      })
    : await tursoDb.projectInvitation.create({
        data: {
          projectId,
          email,
          code: newShareCode(),
          invitedById: gate.user.id,
          expiresAt: inviteExpiry("email"),
        },
      });

  const origin = process.env.NODE_ENV === "production" ? SITE_URL : req.nextUrl.origin;
  const link = projectInviteUrl(origin, invitation.code);
  after(async () => {
    try {
      await sendInvitationEmail({ to: email, inviterName: gate.user.name, projectName: project.name, link });
    } catch (error) {
      console.error("Erro ao enviar o e-mail de convite:", error);
    }
  });

  return NextResponse.json(
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        createdAt: invitation.createdAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
      },
    },
    { status: open ? 200 : 201 }
  );
}
