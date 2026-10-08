// Arquivos de texto anexados ao chat. O conteúdo vai junto da mensagem, entre marcadores,
// para a IA ler e para a bolha da conversa mostrar o arquivo como um anexo (não como texto).

/** Extensões aceitas: texto puro, dados e código (a IA atual só lê texto). */
export const ATTACHMENT_EXTENSIONS = [
  ".txt", ".md", ".csv", ".tsv", ".json", ".xml", ".yaml", ".yml", ".toml", ".ini", ".log",
  ".ino", ".c", ".h", ".cpp", ".hpp", ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".cs",
  ".gd", ".html", ".css", ".sql", ".sh",
]

/** Documentos que o servidor converte em texto antes de anexar (/api/attachments). */
export const DOCUMENT_ATTACHMENT_EXTENSIONS = [".pdf", ".docx", ".markdown"]

/** Tudo o que o botão de anexo aceita. */
export const ACCEPTED_ATTACHMENT_EXTENSIONS = [...ATTACHMENT_EXTENSIONS, ...DOCUMENT_ATTACHMENT_EXTENSIONS]

/** Arquivo maior que isto nem é lido. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/**
 * Quanto do arquivo vai para a IA. A IA gratuita aceita poucos tokens por minuto (~1.600
 * tokens de anexo); com a chave própria em "Minhas IAs" cabe bem mais. O que passa disso é
 * condensado (lib/document-text.ts) e a pessoa é avisada.
 */
export const MAX_ATTACHMENT_CHARS = 5000
export const MAX_ATTACHMENT_CHARS_OWN_KEY = 45000

export interface ChatAttachment {
  name: string
  content: string
  /** O arquivo era maior e só o começo foi enviado. */
  truncated: boolean
}

export function isAcceptedAttachment(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return ACCEPTED_ATTACHMENT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/**
 * Lê o arquivo no servidor (PDF e Word viram texto; tudo é limpo e, se preciso, condensado
 * para caber no limite da IA de quem está usando). Lança Error com a mensagem para a pessoa.
 */
export async function uploadAttachment(file: File): Promise<ChatAttachment> {
  if (!isAcceptedAttachment(file.name)) {
    throw new Error("Formato não aceito. Envie PDF, Word (.docx), Markdown, texto ou código.")
  }
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Arquivo grande demais. Envie um arquivo de até 10 MB.")
  const form = new FormData()
  form.append("file", file)
  const res = await fetch("/api/attachments", { method: "POST", body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Não foi possível ler o arquivo.")
  return data.attachment as ChatAttachment
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
