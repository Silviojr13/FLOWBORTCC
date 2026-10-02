import { tursoDb } from "./turso-db";
import {
  isResourceAvailability,
  isResourceCostModel,
  isResourceType,
  type ResourceAvailability,
  type ResourceCostModel,
  type ResourceType,
} from "./resources";

export interface ResourceInput {
  name?: string;
  description?: string | null;
  type?: ResourceType;
  availability?: ResourceAvailability;
  costModel?: ResourceCostModel;
  unitCost?: number;
  quantity?: number;
  requirementId?: string | null;
}

/**
 * Valida o corpo de criação (partial = false) ou edição (partial = true) de um recurso.
 * Devolve os campos já normalizados ou a mensagem de erro para o usuário.
 */
export async function parseResourceInput(
  body: Record<string, unknown>,
  projectId: string,
  partial: boolean
): Promise<{ data: ResourceInput } | { error: string }> {
  const data: ResourceInput = {};

  if (body.name !== undefined || !partial) {
    if (typeof body.name !== "string" || !body.name.trim()) return { error: "Informe o nome do recurso." };
    data.name = body.name.trim().slice(0, 120);
  }

  if (body.description !== undefined) {
    data.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim().slice(0, 500)
        : null;
  }

  if (body.type !== undefined || !partial) {
    if (!isResourceType(body.type)) return { error: "Tipo de recurso inválido." };
    data.type = body.type;
  }

  if (body.availability !== undefined) {
    if (!isResourceAvailability(body.availability)) return { error: "Disponibilidade inválida." };
    data.availability = body.availability;
  }

  if (body.costModel !== undefined) {
    if (!isResourceCostModel(body.costModel)) return { error: "Forma de cobrança inválida." };
    data.costModel = body.costModel;
  }

  if (body.unitCost !== undefined || !partial) {
    const value = Number(body.unitCost);
    if (!Number.isFinite(value) || value < 0) return { error: "O custo deve ser um valor maior ou igual a zero." };
    data.unitCost = Math.round(value * 100) / 100;
  }

  if (body.quantity !== undefined || !partial) {
    const value = Number(body.quantity ?? 1);
    if (!Number.isFinite(value) || value <= 0) return { error: "A quantidade deve ser maior que zero." };
    data.quantity = Math.round(value * 100) / 100;
  }

  if (body.requirementId !== undefined) {
    if (body.requirementId === null || body.requirementId === "") {
      data.requirementId = null;
    } else {
      const requirement = await tursoDb.requirement.findFirst({
        where: { id: String(body.requirementId), projectId },
        select: { id: true },
      });
      if (!requirement) return { error: "Requisito vinculado não encontrado neste projeto." };
      data.requirementId = requirement.id;
    }
  }

  return { data };
}
