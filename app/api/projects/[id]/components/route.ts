import { NextRequest } from "next/server";
import { authorizeProject } from "../../../../../lib/project-access";
import { tursoDb } from "../../../../../lib/turso-db";
import { isComponentDomain } from "../../../../../lib/resources";

function totalCost(components: { quantity: number; unitPrice: number }[]) {
  return components.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

  try {
    const components = await tursoDb.hardwareComponent.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    // Quem não vê custos (visitante) recebe a lista sem preços nem total.
    const body = gate.access.canSeeCosts
      ? { components, totalCost: totalCost(components) }
      : { components: components.map((c) => ({ ...c, unitPrice: null })), totalCost: null };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar componentes:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar componentes" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId, { edit: "componentes" });
  if (gate instanceof Response) return gate;

  const { name, description, quantity, unitPrice, requirementId, domain } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return new Response(
      JSON.stringify({ error: "Nome do componente é obrigatório" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
    return new Response(
      JSON.stringify({ error: "Quantidade deve ser um número inteiro maior ou igual a 1" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const price = Number(unitPrice);
  if (!Number.isFinite(price) || price < 0) {
    return new Response(
      JSON.stringify({ error: "Preço unitário deve ser um número maior ou igual a 0" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let linkedRequirementId: string | null = null;
  if (requirementId) {
    const requirement = await tursoDb.requirement.findUnique({
      where: { id: requirementId, projectId },
    });
    if (!requirement) {
      return new Response(
        JSON.stringify({ error: "Requisito vinculado não encontrado neste projeto" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    linkedRequirementId = requirement.id;
  }

  try {
    const component = await tursoDb.hardwareComponent.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        quantity: qty,
        unitPrice: price,
        domain: isComponentDomain(domain) ? domain : "Hardware",
        projectId,
        requirementId: linkedRequirementId,
      },
    });

    return new Response(JSON.stringify({ component }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao criar componente:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar componente" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
