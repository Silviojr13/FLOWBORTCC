const storageKey = (projectId: string) => `flowbot:component-origin:${projectId}`

export type ComponentOrigin = "ia" | "manual"

export function loadComponentOrigins(projectId: string): Record<string, ComponentOrigin> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    return raw ? (JSON.parse(raw) as Record<string, ComponentOrigin>) : {}
  } catch {
    return {}
  }
}

export function setComponentOrigin(
  projectId: string,
  componentId: string,
  origin: ComponentOrigin
) {
  const map = loadComponentOrigins(projectId)
  map[componentId] = origin
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey(projectId), JSON.stringify(map))
  }
}

export function removeComponentOrigin(projectId: string, componentId: string) {
  const map = loadComponentOrigins(projectId)
  delete map[componentId]
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey(projectId), JSON.stringify(map))
  }
}
