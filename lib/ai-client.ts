import { AI_PROVIDER_INFO, type AiProvider } from "./ai-providers"

/**
 * Conversa com as IAs pelo servidor, seja a IA gratuita do FlowBot (Groq) ou uma IA que a
 * pessoa conectou em "Minhas IAs". OpenAI, Gemini, Groq e OpenRouter falam o formato da
 * OpenAI; a Anthropic tem o formato próprio (Messages API). As duas respostas em streaming
 * viram o mesmo fluxo de texto.
 */

export interface AiTarget {
  provider: AiProvider
  apiKey: string
  model: string
}

export interface AiMessage {
  role: "user" | "assistant"
  content: string
}

export type AiErrorKind = "auth" | "quota" | "rate" | "model" | "too_large" | "unavailable" | "other"

/** Falha do provedor já classificada. O texto bruto (com ids da conta) fica só no log. */
export class AiProviderError extends Error {
  constructor(
    public kind: AiErrorKind,
    public status: number,
    public retryAfter: number | null = null
  ) {
    super(`IA respondeu ${status} (${kind})`)
  }
}

const ANTHROPIC_VERSION = "2023-06-01"

function headersFor(target: Pick<AiTarget, "provider" | "apiKey">): Record<string, string> {
  if (target.provider === "anthropic") {
    return {
      "Content-Type": "application/json",
      "x-api-key": target.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    }
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${target.apiKey}`,
  }
  if (target.provider === "openrouter") headers["X-Title"] = "FlowBot"
  return headers
}

/** A Anthropic exige falas alternadas: mensagens seguidas do mesmo lado viram uma só. */
function alternate(messages: AiMessage[]): AiMessage[] {
  const merged: AiMessage[] = []
  for (const m of messages) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) last.content = `${last.content}\n\n${m.content}`
    else merged.push({ ...m })
  }
  while (merged.length > 0 && merged[0].role !== "user") merged.shift()
  return merged
}

function requestFor(
  target: AiTarget,
  { system, messages, maxTokens }: { system: string; messages: AiMessage[]; maxTokens: number }
): { url: string; body: unknown } {
  const base = AI_PROVIDER_INFO[target.provider].baseUrl
  if (target.provider === "anthropic") {
    return {
      url: `${base}/messages`,
      body: { model: target.model, max_tokens: maxTokens, stream: true, system, messages: alternate(messages) },
    }
  }
  return {
    url: `${base}/chat/completions`,
    body: {
      model: target.model,
      stream: true,
      // Os modelos de raciocínio da OpenAI só aceitam max_completion_tokens.
      ...(target.provider === "openai" ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
      messages: [{ role: "system", content: system }, ...messages],
    },
  }
}

/** "Please try again in 23.45s" ou "in 1m2.5s" -> segundos. */
export function parseRetrySeconds(message: string): number | null {
  const match = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(message)
  if (!match) return null
  return Number(match[1] ?? 0) * 60 + Number(match[2])
}

function classify(status: number, text: string, retryAfterHeader: number): AiProviderError {
  const lower = text.toLowerCase()
  if (status === 402 || /insufficient_quota|credit balance|billing|out of credits|insufficient credits/.test(lower)) {
    return new AiProviderError("quota", status)
  }
  if (status === 429) {
    const wait = retryAfterHeader > 0 ? retryAfterHeader : parseRetrySeconds(text) ?? 30
    return new AiProviderError("rate", status, Math.ceil(wait))
  }
  // O Gemini responde 400 (e não 401) para chave inválida.
  if (status === 401 || /api.key.not.valid|api_key_invalid|valid api key|invalid.api.key|incorrect api key|invalid x-api-key/.test(lower)) {
    return new AiProviderError("auth", status)
  }
  // O Groq responde 403 quando o modelo está bloqueado no projeto, não a chave.
  if (status === 403) return new AiProviderError(/model/.test(lower) ? "model" : "auth", status)
  if (status === 413 || /context.length|context window|too long|maximum context|prompt is too long/.test(lower)) {
    return new AiProviderError("too_large", status)
  }
  if (status === 404 || /model_not_found|does not exist|not found|not_found_error|unknown model|invalid model/.test(lower)) {
    return new AiProviderError("model", status)
  }
  if (status >= 500) return new AiProviderError("unavailable", status)
  return new AiProviderError("other", status)
}

const RETRY_DELAY_MS = 2000
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Abre a resposta em streaming. Tenta de novo em falhas passageiras (rede, 500/503) e, no
 * limite por minuto, quando o provedor pede uma espera curta. Lança AiProviderError.
 */
export async function openChatStream(
  target: AiTarget,
  request: { system: string; messages: AiMessage[]; maxTokens: number },
  { retries = 2, logLabel = target.provider }: { retries?: number; logLabel?: string } = {}
): Promise<Response> {
  const { url, body } = requestFor(target, request)
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(url, { method: "POST", headers: headersFor(target), body: JSON.stringify(body) })
    } catch {
      if (attempt >= retries) throw new AiProviderError("unavailable", 503)
      await wait(RETRY_DELAY_MS)
      continue
    }
    if (res.ok) return res

    const retryAfter = Number(res.headers.get("retry-after"))
    const text = await res.text()
    const error = classify(res.status, text, retryAfter)
    const transient = res.status === 500 || res.status === 503 || res.status === 529
    if (attempt < retries && transient) {
      console.log(`[${logLabel}] HTTP ${res.status}, tentativa ${attempt + 1}/${retries}...`)
      await wait(RETRY_DELAY_MS)
      continue
    }
    if (attempt < retries && error.kind === "rate" && (error.retryAfter ?? 99) <= 12) {
      console.log(`[${logLabel}] Limite por minuto; aguardando ${error.retryAfter}s...`)
      await wait((error.retryAfter ?? 1) * 1000)
      continue
    }
    console.log(`[${logLabel}] Resposta de erro (${res.status}):`, text.slice(0, 500))
    throw error
  }
}

export interface StreamPiece {
  text?: string
  /** A resposta parou por falta de espaço (limite de tokens de saída). */
  cutByLength?: boolean
}

/** Lê o SSE do provedor e devolve só o texto. Uma linha partida em dois pedaços é remontada. */
export async function* readChatStream(provider: AiProvider, res: Response): AsyncGenerator<StreamPiece> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let pending = ""

  const parse = (line: string): StreamPiece | null => {
    if (!line.startsWith("data:")) return null
    const json = line.slice("data:".length).trim()
    if (!json || json === "[DONE]") return null
    try {
      const parsed = JSON.parse(json)
      if (provider === "anthropic") {
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") return { text: parsed.delta.text }
        if (parsed.type === "message_delta" && parsed.delta?.stop_reason === "max_tokens") return { cutByLength: true }
        return null
      }
      const choice = parsed.choices?.[0]
      return {
        text: choice?.delta?.content || undefined,
        cutByLength: choice?.finish_reason === "length" || undefined,
      }
    } catch {
      return null // comentário do SSE ou linha que não é JSON
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      const lines = pending.split("\n")
      pending = lines.pop() ?? ""
      for (const line of lines) {
        const piece = parse(line)
        if (piece && (piece.text || piece.cutByLength)) yield piece
      }
    }
    pending += decoder.decode()
    const piece = parse(pending)
    if (piece && (piece.text || piece.cutByLength)) yield piece
  } finally {
    reader.releaseLock()
  }
}

/** Modelos que não conversam (áudio, imagem, embeddings...) ficam fora da lista. */
const NOT_CHAT = /(embed|whisper|tts|audio|realtime|transcri|image|imagen|dall-e|moderation|search|babbage|davinci|guard|aqa|veo|lyria|computer-use|codex-mini|orpheus|playai)/i

/** Lista os modelos que a chave pode usar. Lança AiProviderError se a chave for recusada. */
export async function listModels(provider: AiProvider, apiKey: string): Promise<string[]> {
  const base = AI_PROVIDER_INFO[provider].baseUrl
  const url = provider === "anthropic" ? `${base}/models?limit=100` : `${base}/models`
  let res: Response
  try {
    res = await fetch(url, { headers: headersFor({ provider, apiKey }) })
  } catch {
    throw new AiProviderError("unavailable", 503)
  }
  if (!res.ok) throw classify(res.status, await res.text(), Number(res.headers.get("retry-after")))
  const data = (await res.json().catch(() => ({}))) as { data?: { id?: string }[] }
  const ids = (data.data ?? [])
    .map((m) => String(m.id ?? "").replace(/^models\//, ""))
    .filter((id) => id && !NOT_CHAT.test(id))
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
}

/**
 * Confere chave e modelo com um pedido mínimo. Lança AiProviderError se não funcionar.
 * (Listar modelos não basta: no OpenRouter a lista é pública e não valida a chave.)
 */
export async function testConnection(target: AiTarget): Promise<void> {
  const res = await openChatStream(
    target,
    { system: "Responda apenas: OK", messages: [{ role: "user", content: "Teste de conexão do FlowBot." }], maxTokens: 16 },
    { retries: 0, logLabel: `teste ${target.provider}` }
  )
  await res.body?.cancel().catch(() => {})
}

/** Mensagem para a pessoa, conforme o tipo de falha e de quem é a chave. */
export function friendlyAiError(error: AiProviderError, owner: { providerOf: string; ownKey: boolean }): string {
  const who = owner.ownKey ? `A sua chave ${owner.providerOf}` : "A IA do FlowBot"
  switch (error.kind) {
    case "auth":
      return owner.ownKey
        ? `${who} foi recusada. Confira se ela está correta e ativa em Minhas IAs.`
        : "A IA do FlowBot não está disponível agora. Tente de novo em instantes."
    case "quota":
      return owner.ownKey
        ? `${who} está sem créditos. Adicione créditos no site do provedor ou volte para a IA gratuita do FlowBot em Minhas IAs.`
        : "A IA do FlowBot atingiu o limite de uso. Tente de novo mais tarde."
    case "rate":
      return `${who} atingiu o limite de uso por minuto. Aguarde um pouco e envie de novo.`
    case "model":
      return owner.ownKey
        ? `O modelo escolhido não está disponível para a sua chave ${owner.providerOf}. Escolha outro em Minhas IAs.`
        : "O modelo da IA do FlowBot não está disponível agora."
    case "too_large":
      return "A conversa ficou grande demais para o limite da IA. Comece uma nova conversa ou resuma o que já foi definido."
    case "unavailable":
      return owner.ownKey
        ? `O serviço ${owner.providerOf} não respondeu agora. Tente de novo em instantes.`
        : "Não foi possível conectar à IA do FlowBot. Tente de novo em instantes."
    default:
      return "A IA não conseguiu responder agora. Tente de novo em instantes."
  }
}
