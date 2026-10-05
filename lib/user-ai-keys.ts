import { tursoDb } from "./turso-db"
import { decryptApiKey } from "./ai-keys-crypto"
import { AI_PROVIDER_INFO, isAiProvider, type AiKeySummary, type AiProvider } from "./ai-providers"
import { AiProviderError, friendlyAiError, type AiTarget } from "./ai-client"

/** Campos lidos do banco: nunca inclui a chave cifrada, que não sai do servidor. */
export const AI_KEY_SUMMARY_SELECT = {
  id: true,
  provider: true,
  label: true,
  model: true,
  keyHint: true,
  useInAssistant: true,
  lastTestedAt: true,
  createdAt: true,
} as const

type SummaryRow = {
  id: string
  provider: string
  label: string | null
  model: string
  keyHint: string
  useInAssistant: boolean
  lastTestedAt: Date | null
  createdAt: Date
}

export function toAiKeySummary(row: SummaryRow): AiKeySummary | null {
  if (!isAiProvider(row.provider)) return null
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    model: row.model,
    keyHint: row.keyHint,
    useInAssistant: row.useInAssistant,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Chave de uma pessoa, já aberta, para falar com o provedor. Null se não existir ou não abrir. */
export async function loadAiTarget(keyId: string, userId: string): Promise<AiTarget | null> {
  const row = await tursoDb.userAiKey.findFirst({
    where: { id: keyId, userId },
    select: { provider: true, model: true, encryptedKey: true },
  })
  if (!row || !isAiProvider(row.provider)) return null
  const apiKey = decryptApiKey(row.encryptedKey)
  return apiKey ? { provider: row.provider, apiKey, model: row.model } : null
}

/**
 * A IA que responde no assistente para esta pessoa: a chave marcada em "Minhas IAs" ou,
 * sem ela, null (fica a IA gratuita do FlowBot).
 */
export async function assistantAiKey(
  userId: string
): Promise<{ id: string; target: AiTarget } | { id: string; target: null } | null> {
  const row = await tursoDb.userAiKey.findFirst({
    where: { userId, useInAssistant: true },
    select: { id: true, provider: true, model: true, encryptedKey: true },
  })
  if (!row) return null
  if (!isAiProvider(row.provider)) return { id: row.id, target: null }
  const apiKey = decryptApiKey(row.encryptedKey)
  return { id: row.id, target: apiKey ? { provider: row.provider, apiKey, model: row.model } : null }
}

/** Resposta de erro das rotas de "Minhas IAs" quando o provedor recusa a chave ou o modelo. */
export function aiKeyErrorResponse(error: unknown, provider: AiProvider): Response {
  if (error instanceof AiProviderError) {
    const message = friendlyAiError(error, { providerOf: AI_PROVIDER_INFO[provider].of, ownKey: true })
    // 422 e não 401/403: a sessão da pessoa está ok, quem recusou foi o provedor.
    return Response.json({ error: message, kind: error.kind }, { status: error.kind === "unavailable" ? 502 : 422 })
  }
  console.error("Erro ao falar com o provedor de IA:", error)
  return Response.json({ error: "Não foi possível falar com o provedor agora. Tente de novo." }, { status: 502 })
}
