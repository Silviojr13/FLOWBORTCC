import { randomBytes } from "crypto";
import { tursoDb } from "./turso-db";
import {
  STUDY_TASKS,
  type StudyInvite,
  type StudyParticipation,
  type StudyTaskKey,
} from "./study";

export async function isAdmin(userId: string): Promise<boolean> {
  const user = await tursoDb.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "admin";
}

/** Código curto e difícil de adivinhar para o link de convite. */
export function newInviteCode(): string {
  return randomBytes(6).toString("base64url");
}

function latest(...dates: (Date | null | undefined)[]): Date | null {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  return valid.length ? new Date(Math.max(...valid.map((d) => d.getTime()))) : null;
}

/**
 * Detecta, a partir dos dados do próprio participante, quais tarefas do roteiro já foram
 * cumpridas desde o aceite. Devolve o momento de conclusão de cada uma (ou null).
 * Projetos de exemplo do tour não contam. A exportação do PDF é gerada no navegador e
 * chega por evento (marcação "auto" enviada pela tela de relatórios).
 */
async function detectTasks(
  userId: string,
  since: Date
): Promise<Partial<Record<StudyTaskKey, Date>>> {
  const ownProjects = { userId, isTutorial: false };
  const result: Partial<Record<StudyTaskKey, Date>> = {};

  const [user, aiProject, tasks, moves, sprints, components, resource, diagram] = await Promise.all([
    tursoDb.user.findUnique({ where: { id: userId }, select: { onboardingCompletedAt: true } }),
    tursoDb.project.findFirst({
      where: { ...ownProjects, origin: "ia", createdAt: { gte: since }, requirements: { some: {} } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    tursoDb.task.findMany({
      where: {
        project: ownProjects,
        createdAt: { gte: since },
        requirementId: { not: null },
        assignee: { not: null },
        dueDate: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
      take: 2,
    }),
    tursoDb.taskHistory.findFirst({
      where: { task: { project: ownProjects }, fromColumn: { not: null }, changedAt: { gte: since } },
      orderBy: { changedAt: "asc" },
      select: { changedAt: true },
    }),
    tursoDb.sprint.findMany({
      where: { project: ownProjects, createdAt: { gte: since } },
      select: { createdAt: true, tasks: { select: { updatedAt: true } } },
    }),
    tursoDb.hardwareComponent.findMany({
      where: { project: ownProjects, createdAt: { gte: since }, unitPrice: { gt: 0 } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
      take: 2,
    }),
    tursoDb.resource.findFirst({
      where: { project: ownProjects, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    tursoDb.diagram.findFirst({
      where: { project: ownProjects, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  // Quem aceitou o convite já com o onboarding feito cumpre a tarefa no próprio aceite.
  if (user?.onboardingCompletedAt) result["primeiro-acesso"] = latest(user.onboardingCompletedAt, since)!;
  if (aiProject) result["projeto-ia"] = aiProject.createdAt;
  if (tasks.length >= 2 && moves) result["kanban"] = latest(tasks[1].createdAt, moves.changedAt)!;

  const sprint = sprints.find((s) => s.tasks.length >= 2);
  if (sprint) result["sprint"] = latest(sprint.createdAt, ...sprint.tasks.map((t) => t.updatedAt))!;

  if (components.length >= 2 && resource) {
    result["custos"] = latest(components[1].createdAt, resource.createdAt)!;
  }
  if (diagram) result["diagrama"] = diagram.createdAt;

  return result;
}

/** Participação mais recente do usuário em uma avaliação aberta, com o progresso atualizado. */
export async function loadParticipation(userId: string): Promise<StudyParticipation | null> {
  const participant = await tursoDb.studyParticipant.findFirst({
    where: { userId, study: { status: "aberta" } },
    orderBy: { consentAt: "desc" },
    include: { study: true, tasks: true },
  });
  if (!participant) return null;

  // Registra o que o sistema reconheceu desde a última consulta.
  const recorded = new Set(participant.tasks.map((t) => t.taskKey));
  if (recorded.size < STUDY_TASKS.length && !participant.submittedAt) {
    const detected = await detectTasks(userId, participant.consentAt);
    const fresh = Object.entries(detected).filter(([key]) => !recorded.has(key)) as [StudyTaskKey, Date][];
    for (const [taskKey, completedAt] of fresh) {
      const created = await tursoDb.studyTaskProgress.upsert({
        where: { participantId_taskKey: { participantId: participant.id, taskKey } },
        create: { participantId: participant.id, taskKey, method: "auto", completedAt },
        update: {},
      });
      participant.tasks.push(created);
    }
  }

  const byKey = new Map(participant.tasks.map((t) => [t.taskKey, t]));
  return {
    study: {
      id: participant.study.id,
      title: participant.study.title,
      intro: participant.study.intro,
      privacy: participant.study.privacy,
      contact: participant.study.contact,
      status: participant.study.status,
    },
    consentAt: participant.consentAt.toISOString(),
    submittedAt: participant.submittedAt?.toISOString() ?? null,
    tasks: STUDY_TASKS.map((t) => {
      const progress = byKey.get(t.key);
      return {
        key: t.key,
        title: t.title,
        goal: t.goal,
        doneWhen: t.doneWhen,
        minutes: t.minutes,
        completedAt: progress?.completedAt.toISOString() ?? null,
        method: (progress?.method as "auto" | "manual" | undefined) ?? null,
      };
    }),
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findInvite(code: string): Promise<StudyInvite | null> {
  const study = await tursoDb.study.findUnique({ where: { inviteCode: code } });
  if (!study) return null;
  return {
    source: "link",
    code: study.inviteCode,
    title: study.title,
    intro: study.intro,
    privacy: study.privacy,
    contact: study.contact,
    status: study.status,
  };
}

/**
 * Convite por e-mail pendente para a conta: avaliação aberta, convite não aceito nem
 * recusado e a pessoa ainda não participa dela.
 */
export async function findEmailInvite(userId: string): Promise<StudyInvite | null> {
  const user = await tursoDb.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return null;

  const invitation = await tursoDb.studyInvitation.findFirst({
    where: {
      email: normalizeEmail(user.email),
      acceptedAt: null,
      declinedAt: null,
      study: { status: "aberta", participants: { none: { userId } } },
    },
    orderBy: { invitedAt: "desc" },
    include: { study: true },
  });
  if (!invitation) return null;

  return {
    source: "email",
    code: invitation.study.inviteCode,
    title: invitation.study.title,
    intro: invitation.study.intro,
    privacy: invitation.study.privacy,
    contact: invitation.study.contact,
    status: invitation.study.status,
  };
}

/** Registra o aceite ou a recusa no convite por e-mail da conta, se houver. */
export async function settleEmailInvitation(
  studyId: string,
  userId: string,
  outcome: "accepted" | "declined"
) {
  const user = await tursoDb.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return;
  await tursoDb.studyInvitation.updateMany({
    where: { studyId, email: normalizeEmail(user.email), acceptedAt: null },
    data: outcome === "accepted" ? { acceptedAt: new Date() } : { declinedAt: new Date() },
  });
}
