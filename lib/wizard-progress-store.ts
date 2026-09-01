export interface WizardSkippedSteps {
  requirements?: boolean
}

const storageKey = (projectId: string) => `flowbot:wizard-skipped:${projectId}`

export function loadWizardSkipped(projectId: string): WizardSkippedSteps {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    return raw ? (JSON.parse(raw) as WizardSkippedSteps) : {}
  } catch {
    return {}
  }
}

export function saveWizardSkipped(projectId: string, data: WizardSkippedSteps) {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(projectId), JSON.stringify(data))
}

export function setRequirementsSkipped(projectId: string, skipped: boolean) {
  const current = loadWizardSkipped(projectId)
  if (skipped) {
    saveWizardSkipped(projectId, { ...current, requirements: true })
  } else {
    const next = { ...current }
    delete next.requirements
    saveWizardSkipped(projectId, next)
  }
}

export function isRequirementsSkipped(projectId: string): boolean {
  return loadWizardSkipped(projectId).requirements === true
}
