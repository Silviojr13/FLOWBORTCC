export const PROFILE_OPTIONS = [
  { value: "estudante", label: "Estudante" },
  { value: "professor", label: "Professor ou orientador" },
  { value: "pesquisador", label: "Pesquisador" },
  { value: "desenvolvedor", label: "Desenvolvedor" },
  { value: "entusiasta", label: "Entusiasta de robótica" },
  { value: "outro", label: "Outro" },
  { value: "prefer_not", label: "Prefiro não responder" },
] as const

export const DISCOVERY_OPTIONS = [
  { value: "faculdade", label: "Faculdade ou universidade" },
  { value: "indicacao", label: "Indicação de um amigo ou colega" },
  { value: "professor", label: "Professor ou orientador" },
  { value: "redes_sociais", label: "Redes sociais" },
  { value: "pesquisa", label: "Pesquisa na internet" },
  { value: "evento", label: "Evento ou apresentação" },
  { value: "outro", label: "Outro" },
  { value: "prefer_not", label: "Prefiro não responder" },
] as const

export type ProfileValue = (typeof PROFILE_OPTIONS)[number]["value"]
export type DiscoveryValue = (typeof DISCOVERY_OPTIONS)[number]["value"]

const PROFILE_VALUES = PROFILE_OPTIONS.map((option) => option.value)
const DISCOVERY_VALUES = DISCOVERY_OPTIONS.map((option) => option.value)

export function isProfileValue(value: unknown): value is ProfileValue {
  return typeof value === "string" && PROFILE_VALUES.includes(value as ProfileValue)
}

export function isDiscoveryValue(value: unknown): value is DiscoveryValue {
  return (
    typeof value === "string" &&
    DISCOVERY_VALUES.includes(value as DiscoveryValue)
  )
}

export function optionalAnswer<T extends string>(
  value: unknown,
  isAllowed: (value: unknown) => value is T
): { ok: true; value: T | null } | { ok: false } {
  if (value === null || value === undefined) {
    return { ok: true, value: null }
  }
  if (isAllowed(value)) {
    return { ok: true, value }
  }
  return { ok: false }
}

export function greetingName(name: string | null | undefined) {
  const trimmed = name?.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}
