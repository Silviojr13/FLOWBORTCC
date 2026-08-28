export interface ParsedRequirement {
  description: string
  category: "Funcional" | "Não Funcional"
}

const LINE_RE = /^(RF|RNF)\d{1,2}\s*[–—-]\s*(.+)$/

export function parseRequirementsFromMessage(content: string): ParsedRequirement[] {
  const results: ParsedRequirement[] = []

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()
    const match = line.match(LINE_RE)
    if (!match) continue

    const [, prefix, description] = match
    const cleaned = description.replace(/\*\*/g, "").trim()
    if (!cleaned) continue

    results.push({
      description: cleaned,
      category: prefix === "RNF" ? "Não Funcional" : "Funcional",
    })
  }

  return results
}

export function messageHasGeneratedRequirements(content: string): boolean {
  return (
    /requisitos gerados com sucesso/i.test(content) &&
    parseRequirementsFromMessage(content).length > 0
  )
}
