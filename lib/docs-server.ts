import { tursoDb } from "./turso-db"
import { openChatStream, readChatStream, AiProviderError, type AiTarget } from "./ai-client"
import { assistantAiKey } from "./user-ai-keys"
import { buildProjectContext } from "./project-context"
import type { ProjectAccess } from "./project-access"
import { ROLE_LABELS, isMemberRole } from "./project-permissions"
import { RESOURCE_COST_MODEL_LABELS, RESOURCE_TYPE_LABELS } from "./resources"
import {
  DOC_CUT_NOTE,
  getDocType,
  stripCutNote,
  type DocDataSource,
  type DocRevision,
  type DocSectionDef,
  type DocSectionView,
  type DocSettings,
  type DocTypeDef,
  type DocView,
} from "./docs"

/**
 * Motor da aba Documentação: as tabelas saem direto do banco (nunca ficam desatualizadas),
 * os diagramas vêm da aba Diagramas e as seções de texto são escritas pela IA, uma por
 * chamada, seguindo a norma do documento e as diretrizes do projeto.
 */

export class DocsError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

/* ---------------------------------------------------------------- utilitários */

/** Texto seguro dentro de uma célula de tabela Markdown. */
function cell(text: string | null | undefined): string {
  return (text ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim() || "—"
}

function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n")
}

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const day = (date: Date | null) => (date ? date.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—")

type StoredSections = Record<string, { content: string; source: "ia" | "manual"; updatedAt: string }>

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  try {
    const value = raw ? JSON.parse(raw) : fallback
    return value && typeof value === "object" ? value : fallback
  } catch {
    return fallback
  }
}

/* ---------------------------------------------------------------- tabelas dos dados */

async function loadProjectData(projectId: string) {
  const [requirements, features, tasks, components, sprints, resources, project, members] = await Promise.all([
    tursoDb.requirement.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
    tursoDb.feature.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, include: { requirement: { select: { code: true } } } }),
    tursoDb.task.findMany({
      where: { projectId },
      select: { title: true, requirementId: true, featureId: true, sprintId: true, column: { select: { isDone: true } } },
    }),
    tursoDb.hardwareComponent.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, include: { requirement: { select: { code: true } } } }),
    tursoDb.sprint.findMany({ where: { projectId }, orderBy: { startDate: "asc" } }),
    tursoDb.resource.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    tursoDb.project.findUnique({ where: { id: projectId }, select: { user: { select: { name: true, email: true } } } }),
    tursoDb.projectMember.findMany({ where: { projectId }, select: { role: true, user: { select: { name: true, email: true } } } }),
  ])
  return { requirements, features, tasks, components, sprints, resources, project, members }
}

type ProjectData = Awaited<ReturnType<typeof loadProjectData>>

const personName = (u: { name: string | null; email: string | null } | null | undefined) =>
  u?.name?.trim() || u?.email?.split("@")[0] || "—"

function buildData(source: DocDataSource, d: ProjectData, hideCosts: boolean): string {
  const tasksOf = (pred: (t: ProjectData["tasks"][number]) => boolean) => {
    const list = d.tasks.filter(pred)
    return { total: list.length, done: list.filter((t) => t.column.isDone).length }
  }

  switch (source) {
    case "funcionalidades":
      if (d.features.length === 0) return "_Nenhuma funcionalidade cadastrada._"
      return table(
        ["Funcionalidade", "Situação", "Requisito", "Descrição"],
        d.features.map((f) => [f.name, f.status, f.requirement?.code ?? "—", f.description ?? ""])
      )
    case "requisitos-funcionais":
    case "requisitos-nao-funcionais": {
      const functional = source === "requisitos-funcionais"
      const list = d.requirements.filter((r) => (r.category === "Funcional") === functional)
      if (list.length === 0) return `_Nenhum requisito ${functional ? "funcional" : "não funcional"} cadastrado._`
      return table(
        ["Código", "Descrição", "Prioridade", "Situação", "Nível"],
        list.map((r) => [r.code, r.description, r.priority, r.status, r.level ?? "—"])
      )
    }
    case "rastreabilidade":
      if (d.requirements.length === 0) return "_Nenhum requisito cadastrado._"
      return table(
        ["Requisito", "Funcionalidades", "Tarefas (concluídas/total)", "Componentes"],
        d.requirements.map((r) => {
          const t = tasksOf((x) => x.requirementId === r.id)
          return [
            r.code,
            d.features.filter((f) => f.requirementId === r.id).map((f) => f.name).join("; ") || "—",
            t.total ? `${t.done}/${t.total}` : "—",
            d.components.filter((c) => c.requirementId === r.id).map((c) => c.name).join("; ") || "—",
          ]
        })
      )
    case "cobertura": {
      if (d.requirements.length === 0) return "_Nenhum requisito cadastrado._"
      let covered = 0
      const rows = d.requirements.map((r) => {
        const t = tasksOf((x) => x.requirementId === r.id)
        let status = "Sem tarefa"
        if (t.total > 0 && t.done === t.total) {
          status = "Implementado"
          covered++
        } else if (t.total > 0) status = "Em andamento"
        return [r.code, r.status, status, t.total ? `${Math.round((t.done / t.total) * 100)}%` : "0%"]
      })
      const pct = Math.round((covered / d.requirements.length) * 100)
      return `${table(["Requisito", "Situação do requisito", "Implementação", "Tarefas concluídas"], rows)}\n\n**Cobertura:** ${covered} de ${d.requirements.length} requisitos implementados (${pct}%).`
    }
    case "componentes":
      if (d.components.length === 0) return "_Nenhum componente cadastrado._"
      if (hideCosts) {
        return table(
          ["Componente", "Domínio", "Quantidade", "Requisito", "Descrição"],
          d.components.map((c) => [c.name, c.domain, String(c.quantity), c.requirement?.code ?? "—", c.description ?? ""])
        )
      }
      return `${table(
        ["Componente", "Domínio", "Qtd.", "Preço unitário", "Total", "Requisito"],
        d.components.map((c) => [c.name, c.domain, String(c.quantity), money(c.unitPrice), money(c.unitPrice * c.quantity), c.requirement?.code ?? "—"])
      )}\n\n**Custo total dos componentes:** ${money(d.components.reduce((s, c) => s + c.unitPrice * c.quantity, 0))}.`
    case "sprints":
      if (d.sprints.length === 0) return "_Nenhuma sprint planejada._"
      return table(
        ["Sprint", "Período", "Objetivo", "Tarefas (concluídas/total)"],
        d.sprints.map((s) => {
          const t = tasksOf((x) => x.sprintId === s.id)
          return [s.name, `${day(s.startDate)} a ${day(s.endDate)}`, s.goal ?? "—", `${t.done}/${t.total}`]
        })
      )
    case "equipe":
      return table(
        ["Pessoa", "Papel no projeto"],
        [
          [personName(d.project?.user), ROLE_LABELS.dono],
          ...d.members.map((m) => [personName(m.user), ROLE_LABELS[isMemberRole(m.role) ? m.role : "visitante"]]),
        ]
      )
    case "recursos":
      if (hideCosts) return "_Os recursos e os custos não aparecem para o seu cargo neste projeto._"
      if (d.resources.length === 0) return "_Nenhum recurso cadastrado._"
      return `${table(
        ["Recurso", "Tipo", "Disponibilidade", "Cobrança", "Qtd.", "Custo"],
        d.resources.map((r) => [
          r.name,
          RESOURCE_TYPE_LABELS[r.type as keyof typeof RESOURCE_TYPE_LABELS] ?? r.type,
          r.availability === "adquirir" ? "A adquirir" : "Disponível",
          RESOURCE_COST_MODEL_LABELS[r.costModel as keyof typeof RESOURCE_COST_MODEL_LABELS] ?? r.costModel,
          String(r.quantity),
          money(r.unitCost * r.quantity),
        ])
      )}\n\n**Orçamento dos recursos:** ${money(d.resources.reduce((s, r) => s + r.unitCost * r.quantity, 0))}.`
    case "escopo":
      if (d.features.length === 0) return "_Nenhuma funcionalidade cadastrada._"
      return table(
        ["Funcionalidade", "Requisito", "Situação", "Tarefas (concluídas/total)"],
        d.features.map((f) => {
          const t = tasksOf((x) => x.featureId === f.id)
          return [f.name, f.requirement?.code ?? "—", f.status, `${t.done}/${t.total}`]
        })
      )
  }
}

async function diagramSection(projectId: string, type: string): Promise<string> {
  const diagram = await tursoDb.diagram.findFirst({
    where: { projectId, type },
    orderBy: { updatedAt: "desc" },
    select: { code: true },
  })
  return diagram ? `\`\`\`mermaid\n${diagram.code}\n\`\`\`` : ""
}

/* ---------------------------------------------------------------- diretrizes */

const MAX_REFERENCE_CHARS = 60000

export async function loadSettings(projectId: string) {
  return tursoDb.projectDocSettings.findUnique({ where: { projectId } })
}

export function settingsView(row: Awaited<ReturnType<typeof loadSettings>>): DocSettings {
  return {
    academic: row?.academic ?? false,
    institution: row?.institution ?? null,
    course: row?.course ?? null,
    authors: row?.authors ?? null,
    advisor: row?.advisor ?? null,
    notes: row?.notes ?? null,
    referenceName: row?.referenceName ?? null,
    referenceChars: row?.referenceText?.length ?? 0,
    configured: Boolean(row),
  }
}

export function clipReference(text: string): string {
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_REFERENCE_CHARS)
}

/* ---------------------------------------------------------------- documento */

export async function loadDocument(projectId: string, type: string) {
  return tursoDb.projectDocument.findUnique({ where: { projectId_type: { projectId, type } } })
}

export async function buildDocView(projectId: string, def: DocTypeDef, hideCosts: boolean): Promise<DocView> {
  const [row, data] = await Promise.all([loadDocument(projectId, def.key), loadProjectData(projectId)])
  const stored = parseJson<StoredSections>(row?.sections, {})
  const sections: DocSectionView[] = []
  for (const s of def.sections) {
    if (s.kind === "dados" && s.data) {
      sections.push({ ...sectionBase(s), content: buildData(s.data, data, hideCosts), source: "dados", updatedAt: null })
    } else if (s.kind === "diagrama" && s.diagram) {
      sections.push({ ...sectionBase(s), content: await diagramSection(projectId, s.diagram), source: "diagrama", updatedAt: null })
    } else {
      const saved = stored[s.key]
      sections.push({ ...sectionBase(s), content: saved?.content ?? "", source: saved?.source ?? null, updatedAt: saved?.updatedAt ?? null })
    }
  }
  return {
    type: def.key,
    title: def.title,
    standard: def.standard,
    purpose: def.purpose,
    version: row?.version ?? "0.1",
    revisions: parseJson<DocRevision[]>(row?.revisions, []),
    sections,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  }
}

function sectionBase(s: DocSectionDef) {
  return { key: s.key, title: s.title, kind: s.kind, guide: s.guide }
}

export async function saveSection(projectId: string, type: string, key: string, content: string, source: "ia" | "manual") {
  const row = await loadDocument(projectId, type)
  const stored = parseJson<StoredSections>(row?.sections, {})
  stored[key] = { content, source, updatedAt: new Date().toISOString() }
  await tursoDb.projectDocument.upsert({
    where: { projectId_type: { projectId, type } },
    create: { projectId, type, sections: JSON.stringify(stored) },
    update: { sections: JSON.stringify(stored) },
  })
}

/** Nova versão do documento, com a nota no histórico de revisões. */
export async function publishVersion(projectId: string, type: string, note: string, author: string | null) {
  const row = await loadDocument(projectId, type)
  const revisions = parseJson<DocRevision[]>(row?.revisions, [])
  const [major, minor] = (row?.version ?? "0.1").split(".").map((n) => Number(n) || 0)
  const version = `${major}.${minor + 1}`
  revisions.push({ version, date: new Date().toISOString(), author, note })
  await tursoDb.projectDocument.upsert({
    where: { projectId_type: { projectId, type } },
    create: { projectId, type, version, revisions: JSON.stringify(revisions) },
    update: { version, revisions: JSON.stringify(revisions) },
  })
  return version
}

/* ---------------------------------------------------------------- escrita pela IA */

const COMPACT = { contextChars: 4500, maxTokens: 900, referenceChars: 2500, otherSections: 1200 }
const FULL = { contextChars: 16000, maxTokens: 3500, referenceChars: 14000, otherSections: 6000 }

async function writerTarget(userId: string): Promise<{ target: AiTarget; compact: boolean; ownKey: boolean }> {
  const own = await assistantAiKey(userId)
  if (own?.target) return { target: own.target, compact: own.target.provider === "groq", ownKey: true }
  if (own && !own.target) throw new DocsError("Não foi possível abrir a chave da IA escolhida em Minhas IAs.", 409)
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new DocsError("A IA gratuita do FlowBot não está configurada no servidor.", 503)
  return { target: { provider: "groq", apiKey, model: process.env.GROQ_MODEL_NAME || "qwen/qwen3.8-27b" }, compact: true, ownKey: false }
}

export class DocsAiError extends Error {
  constructor(
    public cause: AiProviderError,
    public ownKey: boolean,
    public provider: AiTarget["provider"]
  ) {
    super("Falha da IA")
  }
}

/**
 * Escreve uma seção de texto do documento e a salva. Com mode "continue", a IA segue de onde
 * a seção parou (no limite de tamanho), sem repetir o que já foi escrito.
 */
export async function writeSection(
  access: ProjectAccess,
  userId: string,
  def: DocTypeDef,
  section: DocSectionDef,
  instructions: string | null,
  mode: "write" | "continue" = "write"
): Promise<string> {
  const { target, compact, ownKey } = await writerTarget(userId)
  const limits = compact ? COMPACT : FULL
  const projectId = access.projectId
  const [context, settingsRow, row] = await Promise.all([
    buildProjectContext(projectId, access.ownerId, limits.contextChars, { hideCosts: !access.canSeeCosts, devNotes: 3 }),
    loadSettings(projectId),
    loadDocument(projectId, def.key),
  ])

  // As outras seções já escritas mantêm o documento coerente (termos, nomes, numeração).
  const stored = parseJson<StoredSections>(row?.sections, {})
  const others = def.sections
    .filter((s) => s.kind === "ia" && s.key !== section.key && stored[s.key]?.content)
    .map((s) => `## ${s.title}\n${stored[s.key].content}`)
    .join("\n\n")
    .slice(0, limits.otherSections)

  const academic = settingsRow?.academic
    ? `\nENTREGA ACADEMICA: ${[settingsRow.institution, settingsRow.course].filter(Boolean).join(", ") || "sim"}.${settingsRow.authors ? ` Autores: ${settingsRow.authors}.` : ""}${settingsRow.advisor ? ` Orientador: ${settingsRow.advisor}.` : ""} Use linguagem formal, impessoal (terceira pessoa) e precisa.`
    : ""
  const notes = settingsRow?.notes ? `\nDIRETRIZES DA EQUIPE: ${settingsRow.notes.slice(0, 800)}` : ""
  const reference = settingsRow?.referenceText
    ? `\n\n--- MODELO DE REFERENCIA ANEXADO (${settingsRow.referenceName ?? "documento"}) ---\nSiga a estrutura, a terminologia e as exigencias deste modelo quando se aplicarem a esta secao. Nao copie o texto dele.\n${settingsRow.referenceText.slice(0, limits.referenceChars)}\n--- FIM DO MODELO ---`
    : ""

  const system = `Voce e um engenheiro redator tecnico. Escreve a documentacao de engenharia do projeto em portugues brasileiro, seguindo as normas internacionais de engenharia de software (ISO/IEC/IEEE), de forma que qualquer engenheiro, de qualquer pais, entenda.

DOCUMENTO: ${def.title} — estrutura conforme ${def.standard}.
Proposito do documento: ${def.purpose}
SECAO A ESCREVER: "${section.title}"
O que a secao deve conter: ${section.guide}${academic}${notes}

Regras:
- Escreva so o conteudo da secao, em Markdown. Nao repita o titulo da secao; use subtitulos com ### quando precisar.
- Baseie-se SOMENTE nos dados do projeto abaixo. Cite requisitos pelo codigo (RF01, RNF02) e funcionalidades, tarefas e sprints pelo nome. Nunca invente dados; quando algo nao estiver definido, escreva "A definir" ou registre como premissa.
- Seja objetivo e tecnico. Use tabelas Markdown quando a secao pedir tabela.
- Mantenha a coerencia com as outras secoes ja escritas (mesmos termos e identificadores).
- Nao escreva blocos flowbot-actions nem codigo de diagrama.${instructions ? `\n- Instrucoes de quem esta escrevendo: ${instructions.slice(0, 500)}` : ""}

--- DADOS DO PROJETO ---
${context ?? ""}
--- FIM DOS DADOS ---${reference}`

  const user = `${others ? `Secoes ja escritas deste documento:\n${others}\n\n` : ""}Escreva a secao "${section.title}".`

  // Continuar: a parte já escrita entra como a resposta anterior da IA.
  const previous = mode === "continue" ? stripCutNote(stored[section.key]?.content ?? "") : ""
  if (mode === "continue" && !previous) throw new DocsError("A seção ainda não foi escrita.", 400)
  const messages: { role: "user" | "assistant"; content: string }[] =
    mode === "continue"
      ? [
          { role: "user", content: user },
          { role: "assistant", content: previous },
          {
            role: "user",
            content:
              "Continue exatamente de onde o texto parou, sem repetir nada do que ja foi escrito e sem titulo. Se o texto parou no meio de uma frase ou de uma linha de tabela, complete-a. Se a secao ja estiver completa, responda apenas FIM.",
          },
        ]
      : [{ role: "user", content: user }]

  let res: Response
  try {
    res = await openChatStream(target, { system, messages, maxTokens: limits.maxTokens }, { logLabel: "DOCS" })
  } catch (error) {
    if (error instanceof AiProviderError) throw new DocsAiError(error, ownKey, target.provider)
    throw error
  }
  let text = ""
  let cut = false
  for await (const piece of readChatStream(target.provider, res)) {
    if (piece.text) text += piece.text
    if (piece.cutByLength) cut = true
  }
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim()
  // Alguns modelos repetem o título da seção apesar da regra.
  text = text.replace(new RegExp(`^#{1,3}\\s*${section.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n`, "i"), "").trim()

  if (mode === "continue") {
    // "FIM": a seção já estava completa; só sai o aviso de corte.
    const done = /^FIM\.?$/i.test(text)
    // Linha de tabela, lista ou título começa em linha nova; frase partida continua na mesma.
    let glue = " "
    if (/[|\-*\d#]/.test(text[0] ?? "")) glue = "\n"
    else if (previous.endsWith(" ")) glue = ""
    let merged = done || !text ? previous : `${previous}${glue}${text}`
    if (cut && !done) merged += `\n\n${DOC_CUT_NOTE}`
    await saveSection(projectId, def.key, section.key, merged, "ia")
    return merged
  }

  if (!text) throw new DocsError("A IA não escreveu a seção. Tente de novo.", 502)
  if (cut) text += `\n\n${DOC_CUT_NOTE}`

  await saveSection(projectId, def.key, section.key, text, "ia")
  return text
}

export function docOrFail(type: string): DocTypeDef {
  const def = getDocType(type)
  if (!def) throw new DocsError("Documento desconhecido.", 404)
  return def
}
