const storageKey = (projectId: string) => `flowbot:feature-reqs:${projectId}`

export type FeatureRequirementsMap = Record<string, string[]>

export function loadFeatureRequirements(projectId: string): FeatureRequirementsMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    return raw ? (JSON.parse(raw) as FeatureRequirementsMap) : {}
  } catch {
    return {}
  }
}

export function saveFeatureRequirements(projectId: string, map: FeatureRequirementsMap) {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(projectId), JSON.stringify(map))
}

export function getFeatureRequirementIds(
  projectId: string,
  featureId: string,
  apiRequirementId: string | null
): string[] {
  const stored = loadFeatureRequirements(projectId)[featureId]
  if (stored && stored.length > 0) return stored
  return apiRequirementId ? [apiRequirementId] : []
}

export function setFeatureRequirementIds(
  projectId: string,
  featureId: string,
  ids: string[]
) {
  const map = loadFeatureRequirements(projectId)
  if (ids.length === 0) {
    delete map[featureId]
  } else {
    map[featureId] = ids
  }
  saveFeatureRequirements(projectId, map)
}

export function removeFeatureRequirements(projectId: string, featureId: string) {
  const map = loadFeatureRequirements(projectId)
  delete map[featureId]
  saveFeatureRequirements(projectId, map)
}
