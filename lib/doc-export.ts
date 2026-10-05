"use client"

import { marked, type Token, type Tokens } from "marked"
import type { Content, ContextPageSize, TableCell, TDocumentDefinitions } from "pdfmake/interfaces"
import type { DocSettings, DocView } from "./docs"

/**
 * Exportação de um documento da aba Documentação.
 * - Markdown: para o repositório do projeto.
 * - PDF: documento técnico em A4 com capa, controle do documento (versões e normas), sumário,
 *   seções numeradas e os diagramas desenhados. Margens de 3 cm (esquerda e topo) e 2 cm
 *   (direita e base), como pede a ABNT NBR 14724 para trabalhos acadêmicos.
 */

export interface DocExportInfo {
  projectName: string
  settings: DocSettings
}

const COLOR = { primary: "#1d4ed8", text: "#111827", muted: "#6b7280", line: "#d8dee6", headerFill: "#eef2f8", codeFill: "#f5f7fa" }
const CM = 28.35

const dateBR = (iso: string | Date) => new Date(iso).toLocaleDateString("pt-BR")

function fileStem(doc: DocView, projectName: string) {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
  return `${slug(projectName)}-${slug(doc.title)}-v${doc.version}`
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Linhas de identificação usadas na capa e no Markdown. */
function identification(doc: DocView, info: DocExportInfo): [string, string][] {
  const s = info.settings
  const rows: [string, string][] = [
    ["Projeto", info.projectName],
    ["Documento", doc.title],
    ["Versão", doc.version],
    ["Data", dateBR(new Date())],
    ["Norma de referência", doc.standard],
  ]
  if (s.academic && s.institution) rows.push(["Instituição", s.institution])
  if (s.academic && s.course) rows.push(["Curso", s.course])
  if (s.authors) rows.push(["Autores", s.authors])
  if (s.advisor) rows.push(["Orientador", s.advisor])
  return rows
}

/* ---------------------------------------------------------------- Markdown */

export function docToMarkdown(doc: DocView, info: DocExportInfo): string {
  const lines: string[] = [`# ${doc.title}`, "", `> ${doc.purpose}`, ""]
  lines.push("| Campo | Valor |", "| --- | --- |", ...identification(doc, info).map(([k, v]) => `| ${k} | ${v.replace(/\|/g, "\\|")} |`), "")
  lines.push("## Controle do documento", "")
  if (doc.revisions.length === 0) lines.push("_Versão inicial, ainda sem revisões publicadas._", "")
  else {
    lines.push("| Versão | Data | Autor | Descrição |", "| --- | --- | --- | --- |")
    for (const r of doc.revisions) lines.push(`| ${r.version} | ${dateBR(r.date)} | ${r.author ?? "—"} | ${r.note.replace(/\|/g, "\\|")} |`)
    lines.push("")
  }
  doc.sections.forEach((s, i) => {
    const title = /^\d/.test(s.title) ? s.title : `${i + 1}. ${s.title}`
    lines.push(`## ${title}`, "", s.content.trim() || (s.kind === "diagrama" ? "_Diagrama ainda não gerado na aba Diagramas._" : "_Seção ainda não escrita._"), "")
  })
  lines.push("---", "", `_Documento gerado pelo FlowBot em ${dateBR(new Date())}._`, "")
  return lines.join("\n")
}

export function downloadDocMarkdown(doc: DocView, info: DocExportInfo) {
  save(new Blob([docToMarkdown(doc, info)], { type: "text/markdown;charset=utf-8" }), `${fileStem(doc, info.projectName)}.md`)
}

/* ---------------------------------------------------------------- PDF */

type Inline = { text: string; bold?: boolean; italics?: boolean; color?: string; font?: string; decoration?: "underline" | "lineThrough" }

function inline(tokens: Token[] | undefined, style: Partial<Inline> = {}): Inline[] {
  if (!tokens) return []
  const out: Inline[] = []
  for (const t of tokens) {
    switch (t.type) {
      case "strong":
        out.push(...inline((t as Tokens.Strong).tokens, { ...style, bold: true }))
        break
      case "em":
        out.push(...inline((t as Tokens.Em).tokens, { ...style, italics: true }))
        break
      case "del":
        out.push(...inline((t as Tokens.Del).tokens, { ...style, decoration: "lineThrough" }))
        break
      case "codespan":
        out.push({ ...style, text: (t as Tokens.Codespan).text, color: "#334155" })
        break
      case "link":
        out.push(...inline((t as Tokens.Link).tokens, { ...style, color: COLOR.primary }))
        break
      case "br":
        out.push({ ...style, text: "\n" })
        break
      case "text": {
        const tt = t as Tokens.Text
        if (tt.tokens?.length) out.push(...inline(tt.tokens, style))
        else out.push({ ...style, text: decode(tt.text) })
        break
      }
      default:
        if ("text" in t && typeof t.text === "string") out.push({ ...style, text: decode(t.text) })
    }
  }
  return out
}

function decode(text: string) {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

const TABLE_LAYOUT = {
  hLineWidth: () => 0.4,
  vLineWidth: () => 0.4,
  hLineColor: () => COLOR.line,
  vLineColor: () => COLOR.line,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 3,
  paddingBottom: () => 3,
}

async function blocks(tokens: Token[], diagrams: Map<string, string>): Promise<Content[]> {
  const out: Content[] = []
  for (const t of tokens) {
    switch (t.type) {
      case "heading": {
        const h = t as Tokens.Heading
        out.push({ text: inline(h.tokens), style: h.depth <= 3 ? "h3" : "h4" })
        break
      }
      case "paragraph":
        out.push({ text: inline((t as Tokens.Paragraph).tokens), style: "p" })
        break
      case "list": {
        const l = t as Tokens.List
        const items: Content[] = []
        for (const item of l.items) {
          const inner = await blocks(item.tokens, diagrams)
          items.push(inner.length === 1 ? inner[0] : { stack: inner })
        }
        out.push(l.ordered ? { ol: items, style: "list" } : { ul: items, style: "list" })
        break
      }
      case "table": {
        const tb = t as Tokens.Table
        const header: TableCell[] = tb.header.map((c) => ({ text: inline(c.tokens), style: "th", fillColor: COLOR.headerFill }))
        const rows: TableCell[][] = tb.rows.map((r) => r.map((c) => ({ text: inline(c.tokens), style: "td" })))
        // Colunas curtas (código, prioridade, situação) no tamanho do conteúdo; o resto do
        // espaço fica com as colunas de texto longo, como a descrição.
        const longest = tb.header.map((h, i) => Math.max(h.text.length, ...tb.rows.map((r) => r[i]?.text.length ?? 0)))
        const widths = longest.map((len) => (len <= 18 ? "auto" : "*"))
        out.push({
          table: { headerRows: 1, widths, body: [header, ...rows], dontBreakRows: true },
          layout: TABLE_LAYOUT,
          margin: [0, 2, 0, 8],
        })
        break
      }
      case "code": {
        const c = t as Tokens.Code
        const png = c.lang === "mermaid" ? diagrams.get(c.text.trim()) : undefined
        if (png) out.push({ image: png, fit: [17 * CM - 1, 20 * CM], alignment: "center", margin: [0, 4, 0, 8] })
        else if (c.lang === "mermaid") out.push({ text: "(Diagrama disponível na aba Diagramas do FlowBot.)", style: "muted" })
        else out.push({ table: { widths: ["*"], body: [[{ text: c.text, fontSize: 8, color: "#334155", fillColor: COLOR.codeFill }]] }, layout: "noBorders", margin: [0, 2, 0, 8] })
        break
      }
      case "blockquote":
        out.push({ stack: await blocks((t as Tokens.Blockquote).tokens, diagrams), margin: [12, 0, 0, 6], color: COLOR.muted })
        break
      case "hr":
        out.push({ canvas: [{ type: "line", x1: 0, y1: 0, x2: 17 * CM, y2: 0, lineWidth: 0.5, lineColor: COLOR.line }], margin: [0, 6, 0, 6] })
        break
      default:
        break
    }
  }
  return out
}

/**
 * O Mermaid entrega o SVG com largura "100%" e max-width no estilo, que o pdfmake não
 * entende (o desenho saía minúsculo): fixa largura e altura reais, lidas do viewBox.
 */
function sizedSvg(svg: string): string {
  const match = svg.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"/)
  if (!match) return svg
  const [, width, height] = match
  return svg.replace(/<svg([^>]*)>/, (_tag, attrs: string) => {
    const clean = attrs.replace(/\s(width|height|style)="[^"]*"/g, "")
    return `<svg${clean} width="${width}" height="${height}">`
  })
}

/**
 * O motor de SVG do pdfmake ignora o bloco de estilos do Mermaid (o desenho sai preto): o
 * diagrama vira PNG pelo navegador, como na exportação da aba Diagramas, e entra como imagem.
 */
async function svgToPng(svg: string): Promise<string> {
  const match = svg.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"/)
  const width = match ? Number(match[1]) : 800
  const height = match ? Number(match[2]) : 600
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("Falha ao preparar a imagem do diagrama"))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
  const scale = 2
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/png")
}

/** Desenha os diagramas Mermaid do documento (tema claro, para o papel) como PNG. */
async function renderDiagrams(doc: DocView): Promise<Map<string, string>> {
  const { renderMermaid } = await import("@/components/diagrams/mermaid-view")
  const map = new Map<string, string>()
  const codes = doc.sections.flatMap((s) => Array.from(s.content.matchAll(/```mermaid\n([\s\S]*?)```/g), (m) => m[1]))
  for (const code of codes) {
    try {
      map.set(code.trim(), await svgToPng(sizedSvg(await renderMermaid(code.trim(), false))))
    } catch {
      // Diagrama com erro de sintaxe: o PDF mostra o aviso no lugar.
    }
  }
  return map
}

async function buildPdf(doc: DocView, info: DocExportInfo): Promise<TDocumentDefinitions> {
  const diagrams = await renderDiagrams(doc)
  const s = info.settings
  const content: Content[] = []

  // Capa
  if (s.academic && s.institution) content.push({ text: s.institution.toUpperCase(), style: "coverTop" })
  if (s.academic && s.course) content.push({ text: s.course, style: "coverSub" })
  if (s.authors) content.push({ text: s.authors, style: "coverAuthors" })
  content.push(
    { text: info.projectName, style: "coverProject" },
    { text: doc.title, style: "coverTitle" },
    { text: doc.purpose, style: "coverPurpose" },
    { text: `Versão ${doc.version} · ${dateBR(new Date())}`, style: "coverMeta" },
    { text: `Estrutura conforme ${doc.standard}`, style: "coverMeta" }
  )
  if (s.advisor) content.push({ text: `Orientador: ${s.advisor}`, style: "coverMeta" })
  content.push({ text: "", pageBreak: "after" })

  // Controle do documento
  content.push({ text: "Controle do documento", style: "h1" })
  content.push({
    table: {
      widths: [110, "*"],
      body: identification(doc, info).map(([k, v]) => [{ text: k, style: "th", fillColor: COLOR.headerFill }, { text: v, style: "td" }]),
    },
    layout: TABLE_LAYOUT,
    margin: [0, 4, 0, 12],
  })
  content.push({ text: "Histórico de revisões", style: "h3" })
  content.push(
    doc.revisions.length === 0
      ? { text: "Versão inicial, ainda sem revisões publicadas.", style: "muted" }
      : {
          table: {
            headerRows: 1,
            widths: [45, 65, 110, "*"],
            body: [
              ["Versão", "Data", "Autor", "Descrição"].map((h) => ({ text: h, style: "th", fillColor: COLOR.headerFill })),
              ...doc.revisions.map((r) => [r.version, dateBR(r.date), r.author ?? "—", r.note].map((v) => ({ text: v, style: "td" }))),
            ],
          },
          layout: TABLE_LAYOUT,
        }
  )
  content.push({ text: "", pageBreak: "after" })

  // Sumário
  content.push({ toc: { title: { text: "Sumário", style: "h1" }, numberStyle: { fontSize: 10 } } })
  content.push({ text: "", pageBreak: "after" })

  // Seções
  for (const [i, section] of doc.sections.entries()) {
    const title = /^\d/.test(section.title) ? section.title : `${i + 1}. ${section.title}`
    content.push({ text: title, style: "h2", tocItem: true, tocStyle: { fontSize: 10 }, tocMargin: [0, 2, 0, 0] })
    const body = section.content.trim()
    if (!body) {
      content.push({
        text: section.kind === "diagrama" ? "Diagrama ainda não gerado na aba Diagramas." : "Seção ainda não escrita.",
        style: "muted",
      })
      continue
    }
    content.push(...(await blocks(marked.lexer(body), diagrams)))
  }

  return {
    pageSize: "A4",
    pageMargins: [3 * CM, 3 * CM, 2 * CM, 2 * CM],
    info: { title: `${doc.title} — ${info.projectName}`, subject: doc.standard, creator: "FlowBot" },
    header: (page: number, _count: number, size: ContextPageSize) =>
      page <= 1
        ? ""
        : ({
            text: `${info.projectName} · ${doc.title} · v${doc.version}`,
            fontSize: 8,
            color: COLOR.muted,
            margin: [3 * CM, 1.5 * CM, 2 * CM, 0],
            width: size.width,
          } as Content),
    footer: (page: number, count: number) =>
      page <= 1 ? "" : ({ text: `${page} / ${count}`, fontSize: 8, color: COLOR.muted, alignment: "right", margin: [0, 0, 2 * CM, 0] } as Content),
    content,
    defaultStyle: { font: "Roboto", fontSize: 10.5, color: COLOR.text, lineHeight: 1.35 },
    styles: {
      coverTop: { fontSize: 12, bold: true, alignment: "center", margin: [0, 0, 0, 4] },
      coverSub: { fontSize: 11, alignment: "center", margin: [0, 0, 0, 4] },
      coverAuthors: { fontSize: 11, alignment: "center", margin: [0, 40, 0, 0] },
      coverProject: { fontSize: 13, alignment: "center", color: COLOR.muted, margin: [0, 160, 0, 6] },
      coverTitle: { fontSize: 22, bold: true, alignment: "center", margin: [0, 0, 0, 10] },
      coverPurpose: { fontSize: 11, alignment: "center", color: COLOR.muted, margin: [30, 0, 30, 30] },
      coverMeta: { fontSize: 10, alignment: "center", color: COLOR.muted, margin: [0, 2, 0, 0] },
      h1: { fontSize: 15, bold: true, color: COLOR.primary, margin: [0, 0, 0, 8] },
      h2: { fontSize: 13, bold: true, color: COLOR.primary, margin: [0, 14, 0, 6] },
      h3: { fontSize: 11.5, bold: true, margin: [0, 8, 0, 4] },
      h4: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 3] },
      p: { margin: [0, 0, 0, 6], alignment: "justify" },
      list: { margin: [0, 0, 0, 6] },
      th: { bold: true, fontSize: 8.5, color: "#334155" },
      td: { fontSize: 8.5 },
      muted: { fontSize: 9.5, italics: true, color: COLOR.muted, margin: [0, 0, 0, 6] },
    },
  }
}

export async function downloadDocPdf(doc: DocView, info: DocExportInfo) {
  const [pdfMakeModule, fontsModule] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")])
  // Os dois arquivos são CommonJS: o conteúdo vem em `default` no import dinâmico.
  const pdfMake = (pdfMakeModule.default ?? pdfMakeModule) as typeof pdfMakeModule.default
  const fonts = (fontsModule.default ?? fontsModule) as typeof fontsModule.default
  pdfMake.addVirtualFileSystem(fonts)
  pdfMake.createPdf(await buildPdf(doc, info)).download(`${fileStem(doc, info.projectName)}.pdf`)
}
