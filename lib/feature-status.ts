export const FEATURE_STATUSES = [
  "Planejada",
  "Em desenvolvimento",
  "Concluída",
] as const

export type FeatureStatus = (typeof FEATURE_STATUSES)[number]

export function isFeatureStatus(value: string): value is FeatureStatus {
  return (FEATURE_STATUSES as readonly string[]).includes(value)
}
