import { NextRequest } from "next/server";
import { authorizeProject } from "../../../../../lib/project-access";
import { tursoDb } from "../../../../../lib/turso-db";
import {
  nextRequirementCode,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_STATUSES,
} from "../../../../../lib/requirements-server";

const VALID_CATEGORIES = REQUIREMENT_CATEGORIES;
const VALID_PRIORITIES = REQUIREMENT_PRIORITIES;
const VALID_STATUSES = REQUIREMENT_STATUSES;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

  try {
    const rows = await tursoDb.requirement.findMany({
      where: { projectId },
      orderBy: { code: "asc" },
      include: {
        tasks: { select: { column: { select: { isDone: true } } } },
        components: { select: { quantity: true, unitPrice: true } },
        _count: { select: { features: true } },
      },
    });

    // Cada requisito carrega a repercussão dos outros módulos: quantas tarefas o cobrem,
    // quantas já foram concluídas e quanto custa o hardware associado a ele.
    const requirements = rows.map(({ tasks, components, _count, ...requirement }) => ({
      ...requirement,
      tasksTotal: tasks.length,
      tasksDone: tasks.filter((t) => t.column.isDone).length,
      featuresTotal: _count.features,
      componentsTotal: components.length,
      // Quem não vê custos (visitante) recebe o campo vazio, não o valor.
      estimatedCost: gate.access.canSeeCosts
        ? components.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0)
        : null,
    }));

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
  const gate = await authorizeProject(projectId, { edit: "requisitos" });
  if (gate instanceof Response) return gate;

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
