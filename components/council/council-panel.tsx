"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  ClockIcon,
  LoaderCircleIcon,
  PlayIcon,
  PlusIcon,
  SquareIcon,
  Trash2Icon,
  UsersRoundIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FlowbotActionProposal } from "@/components/project/flowbot-action-proposal"
import {
  COUNCIL_ROLES,
  COUNCIL_ROLE_INFO,
  COUNCIL_TOPICS,
  MAX_COUNCIL_MEMBERS,
  MAX_COUNCIL_ROUNDS,
  MIN_COUNCIL_MEMBERS,
  isCouncilRole,
  type CouncilMeetingSummary,
  type CouncilMeetingView,
  type CouncilMemberInput,
  type CouncilRole,
} from "@/lib/council"
import {
  executeFlowbotActions,
  parseFlowbotActions,
  stripFlowbotActions,
  type ActionResult,
  type FlowbotAction,
} from "@/lib/flowbot-actions"
import { cn } from "@/lib/utils"

interface CouncilData {
  members: CouncilMemberInput[]
  ais: { id: string | null; label: string }[]
  canRun: boolean
  canManage: boolean
  meetings: CouncilMeetingSummary[]
}

const FREE = "free"
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

/** Cores dos membros, na ordem do conselho. */
const MEMBER_COLORS = [
  "bg-primary/15 text-primary",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
]

const markdown = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="my-1">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-1 list-disc pl-5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-1 list-decimal pl-5">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="my-0.5">{children}</li>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
  ),
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

function suggestedMembers(ais: CouncilData["ais"]): CouncilMemberInput[] {
  const firstKey = ais.find((a) => a.id !== null)?.id ?? null
  return [
    { name: "Gerente", role: "gerente", instructions: null, keyId: null },
    { name: "Analista de sprints", role: "analista_sprints", instructions: null, keyId: firstKey },
    { name: "Revisor de requisitos", role: "revisor_requisitos", instructions: null, keyId: null },
  ]
}

async function request<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T & { error?: string; retryAfter?: number | null } }> {
  const res = await fetch(url, { ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

/**
 * Conselho de IAs: a pessoa monta a equipe de IAs com cargos, abre uma reunião sobre um
 * tema e acompanha as falas. No fim, o relator escreve a ata e propõe alterações, que só
 * entram no projeto depois da confirmação.
 */
export function CouncilPanel({ projectId }: Readonly<{ projectId: string }>) {
  const router = useRouter()
  const [data, setData] = useState<CouncilData | null>(null)
  const [draft, setDraft] = useState<CouncilMemberInput[] | null>(null)
  const [dirty, setDirty] = useState(false)
  const [savingMembers, setSavingMembers] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const [topic, setTopic] = useState(COUNCIL_TOPICS[0])
  const [rounds, setRounds] = useState("2")
  const [meeting, setMeeting] = useState<CouncilMeetingView | null>(null)
  const [running, setRunning] = useState(false)
  const [waitSeconds, setWaitSeconds] = useState(0)
  const stopRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    request<CouncilData>(`/api/projects/${projectId}/council`)
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) {
          toast.error(body.error || "Não foi possível carregar o conselho.")
          return
        }
        setData(body)
        // Só na primeira carga: depois, o rascunho é o que está na tela (salvo ou não), e
        // recarregar a lista de reuniões não o troca.
        setDraft((current) => current ?? (body.members.length > 0 ? body.members : suggestedMembers(body.ais)))
        // A sugestão inicial ainda não está salva: é salva ao clicar em Salvar ou ao iniciar.
        if (body.members.length === 0) setDirty(true)
      })
      .catch(() => {
        if (!cancelled) toast.error("Não foi possível carregar o conselho. Confira a conexão.")
      })
    return () => {
      cancelled = true
    }
  }, [projectId, reloadToken])

  // Para a reunião ao sair da tela.
  useEffect(
    () => () => {
      stopRef.current = true
    },
    []
  )

  function editMember(index: number, patch: Partial<CouncilMemberInput>) {
    setDraft((current) => current?.map((m, i) => (i === index ? { ...m, ...patch } : m)) ?? null)
    setDirty(true)
  }

  async function saveMembers() {
    if (!draft) return
    setSavingMembers(true)
    const { ok, body } = await request(`/api/projects/${projectId}/council`, {
      method: "PUT",
      body: JSON.stringify({ members: draft }),
    })
    setSavingMembers(false)
    if (!ok) {
      toast.error(body.error || "Não foi possível salvar os membros.")
      return false
    }
    toast.success("Conselho salvo.")
    setDirty(false)
    setReloadToken((t) => t + 1)
    return true
  }

  const drive = useCallback(
    async (start: CouncilMeetingView) => {
      stopRef.current = false
      setRunning(true)
      let current = start
      try {
        while (!stopRef.current && current.status !== "done") {
          const { ok, status, body } = await request<{ meeting: CouncilMeetingView }>(
            `/api/projects/${projectId}/council/meetings/${current.id}/next`,
            { method: "POST", body: JSON.stringify({ expectedTurn: current.nextTurn }) }
          )
          if (ok) {
            current = body.meeting
            setMeeting(current)
            continue
          }
          // Limite por minuto da IA: espera o tempo pedido e continua sozinho.
          if (status === 429) {
            let seconds = Math.min(Math.max(Math.ceil(Number(body.retryAfter) || 20), 3), 90)
            while (seconds > 0 && !stopRef.current) {
              setWaitSeconds(seconds)
              await new Promise((r) => setTimeout(r, 1000))
              seconds -= 1
            }
            setWaitSeconds(0)
            continue
          }
          toast.error(body.error || "A reunião parou por um erro.")
          // Outra aba pode ter avançado: recarrega o estado real.
          if (status === 409) {
            const fresh = await request<{ meeting: CouncilMeetingView }>(
              `/api/projects/${projectId}/council/meetings/${current.id}`
            )
            if (fresh.ok) setMeeting(fresh.body.meeting)
          }
          break
        }
      } finally {
        setRunning(false)
        setWaitSeconds(0)
        setReloadToken((t) => t + 1)
      }
    },
    [projectId]
  )

  async function startMeeting() {
    if (dirty) {
      const saved = await saveMembers()
      if (!saved) return
    }
    const { ok, body } = await request<{ meeting: CouncilMeetingView }>(`/api/projects/${projectId}/council/meetings`, {
      method: "POST",
      body: JSON.stringify({ topic, rounds: Number(rounds) }),
    })
    if (!ok) {
      toast.error(body.error || "Não foi possível abrir a reunião.")
      return
    }
    setMeeting(body.meeting)
    void drive(body.meeting)
  }

  async function openMeeting(id: string) {
    const { ok, body } = await request<{ meeting: CouncilMeetingView }>(`/api/projects/${projectId}/council/meetings/${id}`)
    if (!ok) {
      toast.error(body.error || "Não foi possível abrir a reunião.")
      return
    }
    setMeeting(body.meeting)
  }

  async function deleteMeeting(id: string) {
    if (!window.confirm("Apagar esta reunião e a ata?")) return
    const { ok, body } = await request(`/api/projects/${projectId}/council/meetings/${id}`, { method: "DELETE" })
    if (!ok) {
      toast.error(body.error || "Não foi possível apagar a reunião.")
      return
    }
    toast.success("Reunião apagada.")
    setMeeting((m) => (m?.id === id ? null : m))
    setReloadToken((t) => t + 1)
  }

  if (!data || !draft) return <p className="text-sm text-muted-foreground">Carregando...</p>

  if (meeting) {
    return (
      <MeetingView
        projectId={projectId}
        meeting={meeting}
        running={running}
        waitSeconds={waitSeconds}
        onBack={() => {
          stopRef.current = true
          setMeeting(null)
        }}
        onStop={() => {
          stopRef.current = true
        }}
        onContinue={() => void drive(meeting)}
        onApplied={(m) => {
          setMeeting(m)
          router.refresh()
        }}
      />
    )
  }

  const allFree = draft.every((m) => m.keyId === null)

  return (
    <div className="flex flex-col gap-8">
      {data.canRun && (
        <section
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm dark:shadow-none sm:p-5"
          data-tour="council-members"
        >
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UsersRoundIcon className="size-4 text-primary" aria-hidden />
              Membros do conselho
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cada membro é uma IA com um cargo. Use a IA gratuita do FlowBot ou as IAs que você conectou em Minhas IAs.
              O gerente (ou o primeiro da lista) é o relator e escreve a ata.
              {data.members.length === 0 && " Esta é uma sugestão inicial: ajuste e salve."}
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {draft.map((member, index) => (
              <li key={index} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      MEMBER_COLORS[index % MEMBER_COLORS.length]
                    )}
                    aria-hidden
                  >
                    {initials(member.name) || "?"}
                  </span>
                  <Input
                    value={member.name}
                    maxLength={40}
                    onChange={(e) => editMember(index, { name: e.target.value })}
                    placeholder="Nome do membro"
                    aria-label={`Nome do membro ${index + 1}`}
                    className="sm:w-44"
                  />
                  <Select value={member.role} onValueChange={(role) => editMember(index, { role: role as CouncilRole })}>
                    <SelectTrigger className="w-full sm:w-52" aria-label={`Cargo de ${member.name || "membro"}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNCIL_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {COUNCIL_ROLE_INFO[role].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={member.keyId ?? FREE}
                    onValueChange={(value) => editMember(index, { keyId: value === FREE ? null : value })}
                  >
                    <SelectTrigger className="w-full sm:flex-1" aria-label={`IA de ${member.name || "membro"}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {data.ais.map((ai) => (
                        <SelectItem key={ai.id ?? FREE} value={ai.id ?? FREE}>
                          {ai.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="self-end text-muted-foreground hover:text-destructive sm:self-auto"
                    aria-label={`Remover ${member.name || "membro"}`}
                    disabled={draft.length <= 1}
                    onClick={() => {
                      setDraft(draft.filter((_, i) => i !== index))
                      setDirty(true)
                    }}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
                <Input
                  value={member.instructions ?? ""}
                  maxLength={500}
                  onChange={(e) => editMember(index, { instructions: e.target.value || null })}
                  placeholder={
                    member.role === "personalizado"
                      ? "Descreva o cargo (obrigatório): do que esse membro cuida?"
                      : `Foco: ${COUNCIL_ROLE_INFO[member.role].focus}. Instruções extras (opcional)`
                  }
                  aria-label={`Instruções de ${member.name || "membro"}`}
                  className="text-xs"
                />
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={draft.length >= MAX_COUNCIL_MEMBERS}
              onClick={() => {
                setDraft([...draft, { name: `Membro ${draft.length + 1}`, role: "qualidade", instructions: null, keyId: null }])
                setDirty(true)
              }}
            >
              <PlusIcon />
              Adicionar membro
            </Button>
            <Button size="sm" disabled={!dirty || savingMembers} onClick={() => void saveMembers()} className="gap-1.5">
              {savingMembers && <LoaderCircleIcon className="animate-spin" />}
              Salvar membros
            </Button>
            {dirty && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
          </div>
          {allFree && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Todos os membros usam a IA gratuita: as falas são curtas, e a reunião pode pausar alguns segundos pelo
              limite por minuto. Com as suas IAs, a análise fica mais longa e mais rápida.
            </p>
          )}
        </section>
      )}

      {data.canRun && (
        <section
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm dark:shadow-none sm:p-5"
          data-tour="council-new-meeting"
        >
          <h2 className="text-sm font-medium text-foreground">Nova reunião</h2>
          <div className="flex flex-wrap gap-2">
            {COUNCIL_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  topic === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Textarea
            value={topic}
            maxLength={300}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Tema da reunião"
            aria-label="Tema da reunião"
            rows={2}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={rounds} onValueChange={setRounds}>
              <SelectTrigger className="w-36" aria-label="Rodadas">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_COUNCIL_ROUNDS }, (_, i) => String(i + 1)).map((r) => (
                  <SelectItem key={r} value={r}>
                    {r === "1" ? "1 rodada" : `${r} rodadas`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="gap-1.5"
              disabled={!topic.trim() || draft.length < MIN_COUNCIL_MEMBERS || savingMembers}
              onClick={() => void startMeeting()}
            >
              <PlayIcon />
              Iniciar reunião
            </Button>
            <span className="text-xs text-muted-foreground">
              {draft.length * Number(rounds)} falas e a ata · cada IA vê o que as outras disseram
            </span>
          </div>
          {draft.length < MIN_COUNCIL_MEMBERS && (
            <p className="text-xs text-muted-foreground">O conselho precisa de ao menos {MIN_COUNCIL_MEMBERS} membros.</p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3" data-tour="council-meetings">
        <h2 className="text-sm font-medium text-foreground">Reuniões</h2>
        {data.meetings.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma reunião ainda.{data.canRun ? " Monte o conselho e inicie a primeira." : ""}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {data.meetings.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <button type="button" className="flex min-w-0 flex-1 flex-col items-start text-left" onClick={() => void openMeeting(m.id)}>
                  <span className="truncate text-sm font-medium text-foreground hover:underline">{m.topic}</span>
                  <span className="text-xs text-muted-foreground">
                    {dateTime.format(new Date(m.createdAt))}
                    {m.runner ? ` · ${m.runner}` : ""}
                  </span>
                </button>
                {m.status === "running" ? <Badge variant="outline">Em andamento</Badge> : <Badge variant="secondary">Ata pronta</Badge>}
                {(m.isMine || data.canManage) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Apagar a reunião ${m.topic}`}
                    onClick={() => void deleteMeeting(m.id)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function MeetingView({
  projectId,
  meeting,
  running,
  waitSeconds,
  onBack,
  onStop,
  onContinue,
  onApplied,
}: Readonly<{
  projectId: string
  meeting: CouncilMeetingView
  running: boolean
  waitSeconds: number
  onBack: () => void
  onStop: () => void
  onContinue: () => void
  onApplied: (meeting: CouncilMeetingView) => void
}>) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [results, setResults] = useState<ActionResult[] | null>(null)
  const [discarded, setDiscarded] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [meeting.messages.length, meeting.summary, running])

  const memberIndex = (name: string) => Math.max(0, meeting.members.findIndex((m) => m.name === name))
  const next = meeting.nextTurn < meeting.totalTurns ? meeting.members[meeting.nextTurn % meeting.members.length] : null
  const round = Math.min(Math.floor(meeting.nextTurn / Math.max(1, meeting.members.length)) + 1, meeting.rounds)
  const actions: FlowbotAction[] = meeting.summary ? parseFlowbotActions(meeting.summary) : []
  const roundNote = meeting.rounds > 1 ? ` (rodada ${round} de ${meeting.rounds})` : ""
  const progress = next ? `${next.name} está analisando${roundNote}...` : "O relator está escrevendo a ata..."

  const showProposal = meeting.isMine && actions.length > 0 && !meeting.appliedSummary && !discarded

  async function apply(chosen: FlowbotAction[]) {
    setIsApplying(true)
    try {
      const done = await executeFlowbotActions(projectId, chosen)
      setResults(done)
      const failed = done.filter((r) => !r.ok).length
      if (failed === 0) toast.success(done.length === 1 ? "Alteração aplicada." : `${done.length} alterações aplicadas.`)
      else toast.warning(`${failed} de ${done.length} alteração(ões) falharam.`)
      const appliedSummary = [
        `**Alterações aplicadas** (${done.filter((r) => r.ok).length}/${done.length})`,
        ...done.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.message}`),
      ].join("\n")
      const res = await fetch(`/api/projects/${projectId}/council/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appliedSummary }),
      })
      if (res.ok) onApplied({ ...meeting, appliedSummary })
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível aplicar as alterações.")
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={onBack}>
          <ArrowLeftIcon />
          Voltar ao conselho
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {running ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onStop}>
              <SquareIcon className="size-3.5" />
              Pausar
            </Button>
          ) : (
            meeting.status === "running" &&
            meeting.isMine && (
              <Button size="sm" className="gap-1.5" onClick={onContinue}>
                <PlayIcon />
                Continuar reunião
              </Button>
            )
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{meeting.topic}</h2>
        <p className="text-xs text-muted-foreground">
          {dateTime.format(new Date(meeting.createdAt))}
          {meeting.runner ? ` · reunião de ${meeting.runner}` : ""} · {meeting.members.length} membros ·{" "}
          {meeting.rounds === 1 ? "1 rodada" : `${meeting.rounds} rodadas`}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {meeting.members.map((m, i) => (
            <span key={m.name} className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs">
              <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px] font-semibold", MEMBER_COLORS[i % MEMBER_COLORS.length])}>
                {initials(m.name)}
              </span>
              <span className="text-foreground">{m.name}</span>
              <span className="text-muted-foreground">· {isCouncilRole(m.role) ? COUNCIL_ROLE_INFO[m.role].label : m.role}</span>
            </span>
          ))}
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {meeting.messages.map((msg) => {
          const index = memberIndex(msg.speaker)
          const firstOfRound = msg.turn % meeting.members.length === 0
          return (
            <li key={msg.turn} className="flex flex-col gap-3">
              {firstOfRound && meeting.rounds > 1 && (
                <p className="text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Rodada {msg.round}</p>
              )}
              <div className="flex gap-3">
                <span
                  className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", MEMBER_COLORS[index % MEMBER_COLORS.length])}
                  aria-hidden
                >
                  {initials(msg.speaker)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{msg.speaker}</span>
                    <span>{isCouncilRole(msg.role) ? COUNCIL_ROLE_INFO[msg.role].label : msg.role}</span>
                    <span className="font-mono">· {msg.model}</span>
                  </div>
                  <div className="text-sm leading-relaxed text-foreground">
                    <ReactMarkdown components={markdown}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </li>
          )
        })}

        {running && (
          <li className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            {waitSeconds > 0 ? (
              <>
                <ClockIcon className="size-3.5" />
                Limite por minuto da IA: continuando em {waitSeconds}s...
              </>
            ) : (
              <>
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                {progress}
              </>
            )}
          </li>
        )}
      </ol>

      {meeting.summary && (
        <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <h3 className="text-sm font-semibold text-foreground">Ata da reunião</h3>
          <div className="text-sm leading-relaxed text-foreground">
            <ReactMarkdown components={markdown}>{stripFlowbotActions(meeting.summary)}</ReactMarkdown>
          </div>
          {showProposal && (
            <FlowbotActionProposal
              actions={actions}
              results={results}
              isApplying={isApplying}
              onConfirm={(chosen) => void apply(chosen)}
              onDiscard={() => setDiscarded(true)}
            />
          )}
          {meeting.appliedSummary && (
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-[13px]">
              <ReactMarkdown components={markdown}>{meeting.appliedSummary}</ReactMarkdown>
            </div>
          )}
          {actions.length > 0 && !meeting.isMine && !meeting.appliedSummary && (
            <p className="text-xs text-muted-foreground">
              A ata propõe {actions.length} alteração(ões). Só quem fez a reunião pode aplicá-las.
            </p>
          )}
        </section>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
