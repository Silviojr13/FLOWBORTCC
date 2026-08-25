export interface Requirement {
  id: string
  text: string
}

export function formatRequirementId(n: number): string {
  return `RF${String(n).padStart(2, "0")}`
}

export function getNextRequirementId(requirements: Requirement[]): string {
  const max = requirements.reduce((currentMax, requirement) => {
    const numericId = parseInt(requirement.id.slice(2), 10)
    return Number.isNaN(numericId) ? currentMax : Math.max(currentMax, numericId)
  }, 0)

  return formatRequirementId(max + 1)
}
