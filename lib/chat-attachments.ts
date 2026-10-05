// Arquivos de texto anexados ao chat. O conteúdo vai junto da mensagem, entre marcadores,
// para a IA ler e para a bolha da conversa mostrar o arquivo como um anexo (não como texto).

/** Extensões aceitas: texto puro, dados e código (a IA atual só lê texto). */
export const ATTACHMENT_EXTENSIONS = [
  ".txt", ".md", ".csv", ".tsv", ".json", ".xml", ".yaml", ".yml", ".toml", ".ini", ".log",
  ".ino", ".c", ".h", ".cpp", ".hpp", ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".cs",
  ".gd", ".html", ".css", ".sql", ".sh",
]

/** Arquivo maior que isto nem é lido. */
export const MAX_ATTACHMENT_BYTES = 300 * 1024

/**
 * Quanto do arquivo vai para a IA (~1.600 tokens). O plano gratuito aceita poucos tokens
 * por minuto; o restante é cortado e a pessoa é avisada.
 */
export const MAX_ATTACHMENT_CHARS = 5000

export interface ChatAttachment {
  name: string
  content: string
  /** O arquivo era maior e só o começo foi enviado. */
  truncated: boolean
}

export function isAcceptedAttachment(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return ATTACHMENT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function prepareAttachment(name: string, raw: string): ChatAttachment {
  const text = raw.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim()
  const truncated = text.length > MAX_ATTACHMENT_CHARS
  return { name, content: truncated ? text.slice(0, MAX_ATTACHMENT_CHARS) : text, truncated }
}

const OPEN = /<anexo nome="([^"]*)"( cortado="sim")?>\n?/
const CLOSE = "\n</anexo>"

/** Junta o texto digitado e o anexo numa mensagem só. */
export function withAttachment(text: string, attachment: ChatAttachment | null): string {
  if (!attachment) return text
  const name = attachment.name.replace(/"/g, "'")
  const block = `<anexo nome="${name}"${attachment.truncated ? ' cortado="sim"' : ""}>\n${attachment.content}${CLOSE}`
  return text.trim() ? `${text.trim()}\n\n${block}` : block
}

/** Separa o texto da mensagem e os anexos, para a bolha mostrar cada coisa no seu lugar. */
export function splitAttachments(content: string): { text: string; attachments: ChatAttachment[] } {
  const attachments: ChatAttachment[] = []
  let text = content
  for (let guard = 0; guard < 5; guard++) {
    const open = OPEN.exec(text)
    if (!open) break
    const start = open.index
    const bodyStart = start + open[0].length
    const end = text.indexOf(CLOSE, bodyStart)
    if (end === -1) break
    attachments.push({ name: open[1], content: text.slice(bodyStart, end), truncated: Boolean(open[2]) })
    text = (text.slice(0, start) + text.slice(end + CLOSE.length)).trim()
  }
  return { text, attachments }
}
