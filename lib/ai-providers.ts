/**
 * Catálogo das IAs que a pessoa pode conectar em "Minhas IAs" com a própria chave de API.
 * Só dados públicos: serve tanto à tela quanto ao servidor (lib/ai-client.ts).
 *
 * Os endereços são fixos: a pessoa escolhe o provedor, nunca digita uma URL. Assim o servidor
 * só envia a chave para o provedor dono dela.
 */

export const AI_PROVIDERS = ["openai", "anthropic", "gemini", "groq", "openrouter"] as const

export type AiProvider = (typeof AI_PROVIDERS)[number]

export interface AiProviderInfo {
  label: string
  /** Nome com a preposição certa, para frases: "da OpenAI", "do Groq". */
  of: string
  /** Endereço base da API (OpenAI-compatível, exceto a Anthropic). */
  baseUrl: string
  /** Onde a pessoa cria a chave. */
  keysUrl: string
  /** Começo típico da chave, só para orientar quem cola a chave errada. */
  keyPrefix?: string
  /** Modelos sugeridos, caso a lista do provedor não carregue. */
  suggestedModels: string[]
  /** Observação curta mostrada no formulário. */
  note: string
}

export const AI_PROVIDER_INFO: Record<AiProvider, AiProviderInfo> = {
  openai: {
    label: "OpenAI (ChatGPT)",
    of: "da OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keysUrl: "https://platform.openai.com/api-keys",
    keyPrefix: "sk-",
    suggestedModels: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
    note: "A assinatura do ChatGPT Plus não inclui a API: a chave é cobrada à parte, em platform.openai.com.",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    of: "da Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    keysUrl: "https://console.anthropic.com/settings/keys",
    keyPrefix: "sk-ant-",
    suggestedModels: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5-20251001"],
    note: "A assinatura do Claude Pro não inclui a API: a chave é cobrada à parte, no console da Anthropic.",
  },
  gemini: {
    label: "Google Gemini",
    of: "do Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keysUrl: "https://aistudio.google.com/apikey",
    keyPrefix: "AIza",
    suggestedModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
    note: "A chave do Google AI Studio tem uma cota gratuita diária.",
  },
  groq: {
    label: "Groq",
    of: "do Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keysUrl: "https://console.groq.com/keys",
    keyPrefix: "gsk_",
    suggestedModels: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
    note: "Você ganha uma cota só sua, sem dividir com os outros usuários do FlowBot. As respostas seguem no tamanho compacto do plano gratuito do Groq.",
  },
  openrouter: {
    label: "OpenRouter",
    of: "do OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keysUrl: "https://openrouter.ai/keys",
    keyPrefix: "sk-or-",
    suggestedModels: ["openai/gpt-4o-mini", "anthropic/claude-sonnet-5-5", "google/gemini-2.5-flash"],
    note: "Uma chave só dá acesso a modelos de vários provedores, cobrados por créditos.",
  },
}

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value)
}

/** O que a tela recebe de uma chave salva: nunca a chave em si. */
export interface AiKeySummary {
  id: string
  provider: AiProvider
  label: string | null
  model: string
  keyHint: string
  useInAssistant: boolean
  lastTestedAt: string | null
  createdAt: string
}

/** Nome curto para mostrar a chave: o apelido ou o provedor. */
export function aiKeyDisplayName(key: Pick<AiKeySummary, "label" | "provider">): string {
  return key.label?.trim() || AI_PROVIDER_INFO[key.provider].label
}
