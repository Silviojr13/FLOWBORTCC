export interface ProjectLocalMeta {
  name?: string
  description?: string
  imageDataUrl?: string
}

const storageKey = (projectId: string) => `flowbot:project-meta:${projectId}`

export function loadProjectLocalMeta(projectId: string): ProjectLocalMeta {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    return raw ? (JSON.parse(raw) as ProjectLocalMeta) : {}
  } catch {
    return {}
  }
}

export function saveProjectLocalMeta(projectId: string, meta: ProjectLocalMeta) {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(projectId), JSON.stringify(meta))
}
