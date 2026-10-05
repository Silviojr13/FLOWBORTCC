/**
 * Andamento do desenvolvimento que um agente (Claude Code) registra pelo servidor MCP.
 * Só dados e rótulos: serve ao servidor e à aba Desenvolvimento.
 */

export const DEV_NOTE_KINDS = ["progresso", "concluido", "problema", "pergunta"] as const

export type DevNoteKind = (typeof DEV_NOTE_KINDS)[number]

export const DEV_NOTE_LABELS: Record<DevNoteKind, string> = {
  progresso: "Progresso",
  concluido: "Concluído",
  problema: "Problema",
  pergunta: "Pergunta",
}

export function isDevNoteKind(value: unknown): value is DevNoteKind {
  return typeof value === "string" && (DEV_NOTE_KINDS as readonly string[]).includes(value)
}

/** O que a aba Desenvolvimento recebe de cada registro. */
export interface DevNoteView {
  id: string
  kind: DevNoteKind
  message: string
  link: string | null
  source: string
  createdAt: string
  task: { id: string; title: string } | null
  author: string | null
}
