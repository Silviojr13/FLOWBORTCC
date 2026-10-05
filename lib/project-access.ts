import { getCurrentUser } from "./auth";
import { tursoDb } from "./turso-db";
import { isMemberRole, permissionsFor, type ProjectArea, type ProjectPermissions } from "./project-permissions";

/**
 * Acesso de uma pessoa a um projeto: o dono (quem criou) ou um membro convidado, com as
 * permissões do cargo. Quem não tem acesso recebe null, e as rotas respondem 404, sem
 * revelar que o projeto existe.
 */
export interface ProjectAccess extends ProjectPermissions {
  projectId: string;
  ownerId: string;
}

export async function getProjectAccess(projectId: string, userId: string): Promise<ProjectAccess | null> {
  const project = await tursoDb.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true },
  });
  if (!project) return null;
  if (project.userId === userId) {
    return { projectId, ownerId: project.userId, ...permissionsFor("dono") };
  }
  const member = await tursoDb.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true, canSeeCosts: true },
  });
  if (!member) return null;
  const role = isMemberRole(member.role) ? member.role : "visitante";
  return { projectId, ownerId: project.userId, ...permissionsFor(role, member.canSeeCosts) };
}

/** Só as permissões, sem ids internos, para enviar à interface. */
export function publicPermissions(access: ProjectAccess): ProjectPermissions {
  const { role, canSeeCosts, canEdit, canManagePeople, canDelete, readOnly } = access;
  return { role, canSeeCosts, canEdit, canManagePeople, canDelete, readOnly };
}

export interface ProjectRequirement {
  /** Área que a ação altera; sem ela, basta poder ver o projeto. */
  edit?: ProjectArea;
  /** A resposta tem custos (preços, orçamento, recursos). */
  costs?: boolean;
  managePeople?: boolean;
  /** Ação exclusiva do dono, como excluir o projeto. */
  owner?: boolean;
}

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

function deny(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Porta de entrada das rotas de projeto: confere a sessão, o acesso e o que a ação exige.
 * Devolve a resposta de erro pronta (401, 403 ou 404) ou a pessoa e o acesso dela.
 */
export async function authorizeProject(
  projectId: string,
  need: ProjectRequirement = {}
): Promise<{ user: CurrentUser; access: ProjectAccess } | Response> {
  const user = await getCurrentUser();
  if (!user) return deny("Usuário não autenticado", 401);

  const access = await getProjectAccess(projectId, user.id);
  if (!access) return deny("Projeto não encontrado", 404);

  const forbidden =
    (need.edit && !access.canEdit[need.edit]) ||
    (need.costs && !access.canSeeCosts) ||
    (need.managePeople && !access.canManagePeople) ||
    (need.owner && access.role !== "dono");
  if (forbidden) {
    return deny("Seu cargo neste projeto não permite esta ação.", 403);
  }
  return { user, access };
}
