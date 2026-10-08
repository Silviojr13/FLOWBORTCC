import { ATTACHMENT_EXTENSIONS } from "./chat-attachments"

/**
 * Texto de documentos enviados ao FlowBot (anexos do chat e modelo de referência da
 * Documentação): extrai de PDF, Word e texto, limpa o que só ocupa espaço e, quando o
 * documento não cabe no limite da IA, condensa sem chamar IA nenhuma.
 */

export const DOCUMENT_EXTENSIONS = [".pdf", ".docx", ".md", ".markdown", ".txt"]

export class DocumentFormatError extends Error {
  constructor() {
    super("formato")
  }
}

/** Texto bruto do arquivo. Lança DocumentFormatError para formato não aceito. */
export async function extractDocumentText(fileName: string, bytes: Uint8Array): Promise<string> {
  const name = fileName.toLowerCase()
  if (name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf")
    const pdf = await getDocumentProxy(bytes)
    const { text } = await extractText(pdf, { mergePages: true })
    return text
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth")
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    return value
  }
  if ([...DOCUMENT_EXTENSIONS, ...ATTACHMENT_EXTENSIONS].some((ext) => name.endsWith(ext))) {
    return new TextDecoder("utf-8").decode(bytes)
  }
  throw new DocumentFormatError()
}

/**
 * Tira o que só ocupa espaço: espaços repetidos, hifenização de quebra de linha, números de
 * página e cabeçalhos ou rodapés que se repetem em toda página.
 */
export function compactText(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .replaceAll("\0", "")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())

  const counts = new Map<string, number>()
  for (const line of lines) if (line && line.length <= 80) counts.set(line, (counts.get(line) ?? 0) + 1)

  const kept = lines.filter((line) => {
    if (/^\d{1,4}$/.test(line)) return false
    if (/^(p[áa]gina|page)\s+\d+(\s+(de|of)\s+\d+)?$/i.test(line)) return false
    return !(line.length <= 80 && (counts.get(line) ?? 0) >= 3)
  })
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

// O que costuma carregar requisito, regra ou decisão num documento de projeto (sem acento).
const KEY_STEMS = [
  "deve", "devera", "precisa", "necessari", "obrigatori", "nao pode", "requisit", "regra",
  "restric", "criterio", "objetivo", "escopo", "usuari", "sistema", "funcionalidade", "modulo",
  "prazo", "orcamento", "custo", "sensor", "atuador", "componente", "meta", "entrega",
]
const REQUIREMENT_CODE = /\bRN?F\s?\d/i

function hasKeyTerm(line: string): boolean {
  if (REQUIREMENT_CODE.test(line)) return true
  const plain = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  return KEY_STEMS.some((stem) => plain.includes(stem))
}

function isHeading(line: string): boolean {
  if (/^#{1,6}\s/.test(line)) return true
  if (/^(\d+(\.\d+)*[.)]?|[IVX]+\.)\s+\S/.test(line) && line.length <= 90) return true
  return line.length <= 70 && !/[.;:,]$/.test(line) && /^[\p{Lu}\d]/u.test(line) && line.split(" ").length <= 9
}

const isListItem = (line: string) => /^([-*•–]|\d+[.)]|[a-z][.)])\s/.test(line)

export interface CondensedText {
  text: string
  /** Não coube inteiro: foi condensado (e, se preciso, cortado). */
  condensed: boolean
}

/**
 * Faz o documento caber em maxChars sem IA: mantém títulos, itens de lista e frases com cara
 * de requisito ou regra, depois a primeira frase dos demais parágrafos e, se ainda sobrar
 * espaço, completa esses parágrafos, sempre na ordem original. Só corta no fim se nem isso
 * couber.
 */
export function condenseText(text: string, maxChars: number): CondensedText {
  if (text.length <= maxChars) return { text, condensed: false }

  const blocks = text.split(/\n+/).filter(Boolean)
  const essential = blocks.map((b) => isHeading(b) || isListItem(b) || hasKeyTerm(b))
  const pick = new Array<string | null>(blocks.length).fill(null)
  let used = 0
  const take = (i: number, value: string) => {
    if (used + value.length + 1 > maxChars) return false
    pick[i] = value
    used += value.length + 1
    return true
  }

  // 1º: o essencial, inteiro. 2º: a primeira frase do que sobrou. 3º: o parágrafo inteiro
  // no lugar da primeira frase, enquanto couber.
  for (let i = 0; i < blocks.length; i++) if (essential[i]) take(i, blocks[i])
  for (let i = 0; i < blocks.length; i++) {
    if (pick[i] !== null) continue
    const first = /^.{20,}?[.!?](\s|$)/.exec(blocks[i])?.[0].trim() ?? blocks[i].slice(0, 160)
    take(i, first)
  }
  for (let i = 0; i < blocks.length; i++) {
    const current = pick[i]
    if (current === null || current === blocks[i]) continue
    const extra = blocks[i].length - current.length
    if (used + extra > maxChars) continue
    pick[i] = blocks[i]
    used += extra
  }

  let result = pick.filter((b): b is string => b !== null).join("\n")
  if (!result) result = text.slice(0, maxChars)
  return { text: result.slice(0, maxChars), condensed: true }
}
