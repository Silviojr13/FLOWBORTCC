import { tursoDb } from "./turso-db"
import { AiProviderError, friendlyAiError, openChatStream, readChatStream, type AiTarget } from "./ai-client"
import { AI_PROVIDER_INFO } from "./ai-providers"
import { loadAiTarget } from "./user-ai-keys"
import { buildProjectContext } from "./project-context"
import { estimateTokens } from "./chat-budget"
import { FLOWBOT_ACTIONS_FORMAT } from "./flowbot-action-prompt"
import type { ProjectAccess } from "./project-access"
import {
  COUNCIL_ROLE_INFO,
  isCouncilRole,
  type CouncilMeetingView,
  type CouncilMemberInput,
} from "./council"

/**
 * A reunião do conselho acontece em passos: cada chamada faz uma fala (ou, no fim, a ata).
 * Assim nenhuma chamada fica longa demais para o servidor, e a tela mostra as falas
 * chegando. Os membros e o tema ficam guardados na reunião desde o início.
 */

export class CouncilError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

/** A IA de um membro falhou: a mensagem diz quem e se era a chave da pessoa ou a gratuita. */
export class CouncilAiError extends Error {
  constructor(
    public cause: AiProviderError,
    memberName: string,
    target: AiTarget,
    ownKey: boolean
  ) {
    super(`${memberName}: ${friendlyAiError(cause, { providerOf: AI_PROVIDER_INFO[target.provider].of, ownKey })}`)
  }
}

export type CouncilSnapshot = CouncilMemberInput & { label: string }

const FREE_LABEL = "IA gratuita do FlowBot"

/** A IA gratuita (Groq) e uma chave própria do Groq seguem os limites compactos do plano gratuito. */
const COMPACT = { contextChars: 3000, transcriptTokens: 1800, turnTokens: 450, summaryTokens: 900, maxActions: 10, lines: 6, devNotes: 3 }
const FULL = { contextChars: 14000, transcriptTokens: 8000, turnTokens: 1200, summaryTokens: 3500, maxActions: 25, lines: 10, devNotes: 8 }

/** Nome da IA de cada membro, para a tela e para a reunião. */
export async function memberLabels(userId: string, keyIds: (string | null)[]): Promise<Map<string | null, string>> {
  const ids = keyIds.filter((id): id is string => !!id)
  const keys = ids.length
    ? await tursoDb.userAiKey.findMany({ where: { id: { in: ids }, userId }, select: { id: true, provider: true, model: true, label: true } })
    : []
  const labels = new Map<string | null, string>([[null, FREE_LABEL]])
  for (const k of keys) {
    const provider = AI_PROVIDER_INFO[k.provider as keyof typeof AI_PROVIDER_INFO]?.label ?? k.provider
    labels.set(k.id, `${k.label?.trim() || provider} · ${k.model}`)
  }
  return labels
}

async function targetFor(member: CouncilSnapshot, userId: string): Promise<{ target: AiTarget; compact: boolean }> {
  if (member.keyId) {
    const target = await loadAiTarget(member.keyId, userId)
    if (!target) {
      throw new CouncilError(`A IA de ${member.name} não está mais conectada em Minhas IAs. Troque a IA desse membro e comece outra reunião.`, 409)
    }
    return { target, compact: target.provider === "groq" }
  }
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new CouncilError("A IA gratuita do FlowBot não está configurada no servidor.", 503)
  return { target: { provider: "groq", apiKey, model: process.env.GROQ_MODEL_NAME || "qwen/qwen3.8-27b" }, compact: true }
}

/** Junta a resposta em streaming num texto só (sem o raciocínio que alguns modelos mostram). */
async function collect(
  member: CouncilSnapshot,
  target: AiTarget,
  system: string,
  user: string,
  maxTokens: number
): Promise<{ text: string; cut: boolean }> {
  let res: Response
  try {
    res = await openChatStream(target, { system, messages: [{ role: "user", content: user }], maxTokens }, { logLabel: "CONSELHO" })
  } catch (error) {
    if (error instanceof AiProviderError) throw new CouncilAiError(error, member.name, target, member.keyId !== null)
    throw error
  }
  let text = ""
  let cut = false
  for await (const piece of readChatStream(target.provider, res)) {
    if (piece.text) text += piece.text
    if (piece.cutByLength) cut = true
  }
  return { text: text.replace(/<think>[\s\S]*?<\/think>/g, "").trim(), cut }
}

/** As falas mais recentes que cabem no orçamento; as primeiras saem com um aviso. */
function transcript(messages: { speaker: string; role: string; content: string }[], budgetTokens: number): string {
  const lines: string[] = []
  let used = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    const label = isCouncilRole(m.role) ? COUNCIL_ROLE_INFO[m.role].label : m.role
    const line = `[${m.speaker} — ${label}]: ${m.content}`
    const tokens = estimateTokens(line)
    if (used + tokens > budgetTokens && lines.length > 0) {
      lines.unshift("(falas anteriores omitidas para caber no limite)")
      break
    }
    lines.unshift(line)
    used += tokens
  }
  return lines.join("\n\n")
}

function parseMembers(json: string): CouncilSnapshot[] {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const today = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })

type MeetingRow = NonNullable<Awaited<ReturnType<typeof loadMeeting>>>

export async function loadMeeting(projectId: string, meetingId: string) {
  return tursoDb.aiCouncilMeeting.findFirst({
    where: { id: meetingId, projectId },
    include: { messages: { orderBy: { turn: "asc" } } },
  })
}

export async function meetingView(meeting: MeetingRow, viewerId: string): Promise<CouncilMeetingView> {
  const members = parseMembers(meeting.members)
  const runner = await tursoDb.user.findUnique({ where: { id: meeting.userId }, select: { name: true, email: true } })
  return {
    id: meeting.id,
    topic: meeting.topic,
    status: meeting.status === "done" ? "done" : "running",
    createdAt: meeting.createdAt.toISOString(),
    runner: runner?.name?.trim() || runner?.email?.split("@")[0] || null,
    isMine: meeting.userId === viewerId,
    rounds: meeting.rounds,
    members,
    messages: meeting.messages.map((m) => ({
      turn: m.turn,
      round: m.round,
      speaker: m.speaker,
      role: m.role,
      model: m.model,
      content: m.content,
    })),
    summary: meeting.summary,
    appliedSummary: meeting.appliedSummary,
    nextTurn: meeting.messages.length,
    totalTurns: members.length * meeting.rounds,
  }
}

/** Faz a próxima fala ou, quando todos já falaram, a ata do relator. */
export async function runNextStep(meeting: MeetingRow, access: ProjectAccess, userId: string, expectedTurn: number): Promise<void> {
  const members = parseMembers(meeting.members)
  if (members.length === 0) throw new CouncilError("Reunião sem membros.", 409)
  const total = members.length * meeting.rounds
  const next = meeting.messages.length
  if (meeting.status === "done") throw new CouncilError("A reunião já terminou.", 409)
  if (expectedTurn !== next) throw new CouncilError("A reunião andou em outra aba. Recarregue para ver as falas.", 409)

  const names = members.map((m) => `${m.name} (${COUNCIL_ROLE_INFO[m.role]?.label ?? m.role})`).join(", ")
  const project = await tursoDb.project.findUnique({ where: { id: meeting.projectId }, select: { name: true } })

  if (next < total) {
    const member = members[next % members.length]
    const round = Math.floor(next / members.length) + 1
    const { target, compact } = await targetFor(member, userId)
    const limits = compact ? COMPACT : FULL
    const context =
      (await buildProjectContext(meeting.projectId, access.ownerId, limits.contextChars, {
        hideCosts: !access.canSeeCosts,
        devNotes: limits.devNotes,
      })) ?? ""
    const info = COUNCIL_ROLE_INFO[member.role] ?? COUNCIL_ROLE_INFO.personalizado

    const system = `Voce e "${member.name}", ${info.label} no conselho de IAs do projeto "${project?.name ?? ""}".
Seu foco: ${info.focus}.${member.instructions ? `\nInstrucoes do seu cargo: ${member.instructions}` : ""}
Participantes da reuniao: ${names}.
Tema da reuniao: "${meeting.topic}". Esta e a rodada ${round} de ${meeting.rounds}. Hoje e ${today()}.

Regras:
- Responda em portugues brasileiro, em no maximo ${limits.lines} linhas, sem titulo.
- Baseie-se nos dados do projeto abaixo: cite requisitos pelo codigo e tarefas e sprints pelo nome. Nunca invente dados.
- Fale do seu foco. Comente o que os colegas ja disseram, pelo nome: concorde, discorde ou complemente. Nao repita o que ja foi dito.
- ${round === meeting.rounds ? "E a ultima rodada: feche com a sua recomendacao objetiva." : "Traga a sua analise e uma proposta concreta."}
- Nao escreva blocos de codigo nem o bloco flowbot-actions: quem propoe as alteracoes e o relator, na ata.

--- DADOS DO PROJETO ---
${context}
--- FIM DOS DADOS ---`

    const spoken = transcript(meeting.messages, limits.transcriptTokens)
    const user = `Tema: ${meeting.topic}\n\n${spoken ? `Falas ate agora:\n${spoken}` : "(Voce abre a reuniao.)"}\n\nSua vez, ${member.name}.`
    const { text } = await collect(member, target, system, user, limits.turnTokens)

    try {
      await tursoDb.aiCouncilMessage.create({
        data: {
          meetingId: meeting.id,
          turn: next,
          round,
          speaker: member.name,
          role: member.role,
          model: target.model,
          content: text || "(sem resposta)",
        },
      })
    } catch (error) {
      // Duas abas pedindo a mesma fala: a segunda perde, sem duplicar.
      if ((error as { code?: string }).code === "P2002") throw new CouncilError("Essa fala já foi registrada.", 409)
      throw error
    }
    await tursoDb.aiCouncilMeeting.update({ where: { id: meeting.id }, data: { updatedAt: new Date() } })
    return
  }

  // Ata: o gerente (ou o primeiro membro) é o relator e propõe as alterações.
  const relator = members.find((m) => m.role === "gerente") ?? members[0]
  const { target, compact } = await targetFor(relator, userId)
  const limits = compact ? COMPACT : FULL
  const context =
    (await buildProjectContext(meeting.projectId, access.ownerId, limits.contextChars, {
      hideCosts: !access.canSeeCosts,
      devNotes: limits.devNotes,
    })) ?? ""

  const system = `Voce e "${relator.name}", relator do conselho de IAs do projeto "${project?.name ?? ""}". Participaram: ${names}.
Escreva a ATA da reuniao em portugues brasileiro, curta e objetiva, com estes titulos em negrito:
**Resumo** (2 a 3 linhas), **Decisoes**, **Riscos** e **Proximos passos** (com responsavel quando o projeto tiver nomes).
Depois da ata, proponha as alteracoes no projeto que o conselho recomendou (no maximo ${limits.maxActions} acoes, JSON enxuto). A pessoa vai revisar e confirmar: nunca diga que as alteracoes ja foram feitas. Se nada precisar mudar, nao inclua o bloco.
Hoje e ${today()}: datas novas comecam a partir de hoje.

${FLOWBOT_ACTIONS_FORMAT}

--- DADOS DO PROJETO ---
${context}
--- FIM DOS DADOS ---`
  const user = `Tema: ${meeting.topic}\n\nFalas da reuniao:\n${transcript(meeting.messages, limits.transcriptTokens)}\n\nEscreva a ata e as alteracoes propostas.`
  const { text, cut } = await collect(relator, target, system, user, limits.summaryTokens)

  const updated = await tursoDb.aiCouncilMeeting.updateMany({
    where: { id: meeting.id, status: "running" },
    data: {
      status: "done",
      summary: (text || "(O relator não conseguiu escrever a ata.)") + (cut ? "\n\n_(A ata chegou ao limite de tamanho da IA.)_" : ""),
    },
  })
  if (updated.count === 0) throw new CouncilError("A ata já foi escrita.", 409)
}
