import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { tursoDb } from "../../../../../../lib/turso-db";

async function findOwnedComponent(projectId: string, compId: string, userId: string) {
  const component = await tursoDb.hardwareComponent.findUnique({
    where: { id: compId, projectId },
    include: { project: true },
  });

  if (!component || component.project.userId !== userId) {
    return null;
  }

  return component;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; compId: string }> }
) {
  const { id: projectId, compId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const existing = await findOwnedComponent(projectId, compId, user.id);
  if (!existing) {
    return new Response(
      JSON.stringify({ error: "Componente não encontrado" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const { name, description, quantity, unitPrice, requirementId } = await req.json();

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return new Response(
      JSON.stringify({ error: "Nome do componente não pode ficar vazio" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let qty: number | undefined;
  if (quantity !== undefined) {
    qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
      return new Response(
        JSON.stringify({ error: "Quantidade deve ser um número inteiro maior ou igual a 1" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  let price: number | undefined;
  if (unitPrice !== undefined) {
    price = Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      return new Response(
        JSON.stringify({ error: "Preço unitário deve ser um número maior ou igual a 0" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  let linkedRequirementId: string | null | undefined;
  if (requirementId !== undefined) {
    if (requirementId === null) {
      linkedRequirementId = null;
    } else {
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
  }

  try {
    const component = await tursoDb.hardwareComponent.update({
      where: { id: compId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? (typeof description === "string" ? description.trim() || null : null) : undefined,
        quantity: qty,
        unitPrice: price,
        requirementId: linkedRequirementId,
      },
    });

    return new Response(JSON.stringify({ component }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao atualizar componente:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao atualizar componente" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; compId: string }> }
) {
  const { id: projectId, compId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const existing = await findOwnedComponent(projectId, compId, user.id);
  if (!existing) {
    return new Response(
      JSON.stringify({ error: "Componente não encontrado" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await tursoDb.hardwareComponent.delete({ where: { id: compId } });

    return new Response(JSON.stringify({ message: "Componente excluído com sucesso" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao excluir componente:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao excluir componente" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
