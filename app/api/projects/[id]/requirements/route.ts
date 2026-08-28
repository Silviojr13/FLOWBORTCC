import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import { tursoDb } from "../../../../../lib/turso-db";

const CATEGORY_PREFIX: Record<string, string> = {
  Funcional: "RF",
  "Não Funcional": "RNF",
};

const VALID_CATEGORIES = Object.keys(CATEGORY_PREFIX);
const VALID_PRIORITIES = ["Alta", "Média", "Baixa"];
const VALID_STATUSES = ["Em Aberto", "Validado", "Descartado"];

async function assertProjectOwnership(projectId: string, userId: string) {
  return tursoDb.project.findUnique({ where: { id: projectId, userId } });
}

async function nextRequirementCode(projectId: string, category: string) {
  const prefix = CATEGORY_PREFIX[category];
  const existing = await tursoDb.requirement.findMany({
    where: { projectId, category },
    select: { code: true },
  });

  const max = existing.reduce((currentMax, r) => {
    const n = parseInt(r.code.slice(prefix.length), 10);
    return Number.isNaN(n) ? currentMax : Math.max(currentMax, n);
  }, 0);

  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const project = await assertProjectOwnership(projectId, user.id);
  if (!project) {
    return new Response(
      JSON.stringify({ error: "Projeto não encontrado" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const requirements = await tursoDb.requirement.findMany({
      where: { projectId },
      orderBy: { code: "asc" },
    });

    return new Response(JSON.stringify({ requirements }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar requisitos:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar requisitos" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const project = await assertProjectOwnership(projectId, user.id);
  if (!project) {
    return new Response(
      JSON.stringify({ error: "Projeto não encontrado" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const { description, category, priority, status, level } = await req.json();

  if (!description || typeof description !== "string" || !description.trim()) {
    return new Response(
      JSON.stringify({ error: "Descrição do requisito é obrigatória" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return new Response(
      JSON.stringify({ error: `Categoria deve ser uma de: ${VALID_CATEGORIES.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!VALID_PRIORITIES.includes(priority)) {
    return new Response(
      JSON.stringify({ error: `Prioridade deve ser uma de: ${VALID_PRIORITIES.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const resolvedStatus = status && VALID_STATUSES.includes(status) ? status : "Em Aberto";

  try {
    const code = await nextRequirementCode(projectId, category);

    const requirement = await tursoDb.requirement.create({
      data: {
        code,
        description: description.trim(),
        category,
        priority,
        status: resolvedStatus,
        level: typeof level === "string" && level.trim() ? level.trim() : null,
        projectId,
      },
    });

    return new Response(JSON.stringify({ requirement }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao criar requisito:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar requisito" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
