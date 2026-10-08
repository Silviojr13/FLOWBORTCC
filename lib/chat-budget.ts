/**
 * Orçamento de tokens do assistente. O plano gratuito do Groq aceita poucos tokens de
 * entrada por minuto (7000 no modelo atual); como cada mensagem reenviava a conversa
 * inteira, conversas longas passavam do limite e a IA parava de responder (erro 413).
 *
 * Aqui a conversa é cortada para caber: ficam a primeira mensagem da pessoa (a ideia do
 * projeto) e as mais recentes; as do meio saem, e a IA é avisada disso.
 */

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

/** Estimativa conservadora para português: ~3,2 caracteres por token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2)
}

/**
 * Limite de entrada por pedido. O Groq gratuito conta 7000 tokens por MINUTO: com ~3400 por
 * pedido, duas mensagens seguidas cabem no mesmo minuto. Num plano pago, aumente por
 * GROQ_INPUT_TOKEN_BUDGET.
 */
export const INPUT_TOKEN_BUDGET = Number(process.env.GROQ_INPUT_TOKEN_BUDGET) || 3400

/**
 * Uma mensagem sozinha (por exemplo, com arquivo anexado) não passa disto na IA gratuita.
 * Com chave própria, o chat passa um teto maior.
 */
export const MAX_MESSAGE_TOKENS = 1800

function clipMessage(message: ChatMessage, maxTokens: number): ChatMessage {
  if (estimateTokens(message.content) <= maxTokens) return message
  const keep = Math.max(0, Math.floor(maxTokens * 3.2) - 80)
  return { ...message, content: `${message.content.slice(0, keep)}\n\n[... mensagem cortada por ser longa demais para o limite da IA]` }
}

export interface FittedConversation {
  messages: ChatMessage[]
  /** Quantas mensagens antigas ficaram de fora. */
  omitted: number
}

/** Escolhe as mensagens que cabem no orçamento, dado o tamanho das instruções do sistema. */
export function fitConversation(
  messages: ChatMessage[],
  systemTokens: number,
  budget = INPUT_TOKEN_BUDGET,
  maxMessageTokens = MAX_MESSAGE_TOKENS
): FittedConversation {
  const available = Math.max(1200, budget - systemTokens)
  const clipped = messages.map((m) => clipMessage(m, Math.min(maxMessageTokens, available)))

  // A última mensagem (a pergunta atual) entra sempre.
  const last = clipped[clipped.length - 1]
  let used = estimateTokens(last.content)
  const recent: ChatMessage[] = [last]

  // A primeira mensagem da pessoa costuma ser a ideia do projeto: vale guardar.
  const firstUserIndex = clipped.findIndex((m) => m.role === "user")
  const first = firstUserIndex >= 0 && firstUserIndex < clipped.length - 1 ? clipped[firstUserIndex] : null
  const firstTokens = first ? estimateTokens(first.content) : 0
  const keepFirst = first !== null && used + firstTokens <= available * 0.6
  if (keepFirst) used += firstTokens

  for (let i = clipped.length - 2; i > (keepFirst ? firstUserIndex : -1); i--) {
    const tokens = estimateTokens(clipped[i].content)
    if (used + tokens > available) break
    recent.unshift(clipped[i])
    used += tokens
  }

  const fitted = keepFirst && first ? [first, ...recent] : recent
  // A conversa enviada precisa começar pela pessoa, não por uma resposta da IA solta.
  while (fitted.length > 1 && fitted[0].role === "assistant") fitted.shift()

  return { messages: fitted, omitted: messages.length - fitted.length }
}

export function omittedNote(omitted: number): string {
  return `\n\n--- OBSERVACAO ---\nPara caber no limite de tamanho, ${omitted} mensagem(ns) do meio desta conversa nao foram enviadas. Voce tem a primeira mensagem do usuario e as mais recentes. Se precisar de algo que foi dito antes e nao esta aqui, peca ao usuario para repetir, sem inventar.`
}
