"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import {
  CheckCircle2Icon,
  ClipboardCheckIcon,
  ClockIcon,
  LoaderCircleIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  GETTING_STARTED,
  OPEN_QUESTIONS,
  PROFILE_QUESTIONS,
  SUS_ITEMS,
  SUS_SCALE,
  type StudyInvite,
  type StudyParticipation,
  type StudyTaskStatus,
} from "@/lib/study"
import {
  clearPendingInvite,
  readPendingInvite,
  refreshStudyMe,
  setStudyMe,
  useStudyMe,
} from "@/lib/use-study-me"

type Tab = "tarefas" | "comecar" | "questionario" | "privacidade"
const OPEN_KEY = "flowbot:guia-participante-aberto"

const emptySubscribe = () => () => {}
function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0"
  } catch {
    return true
  }
}

function writeOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0")
  } catch {
    /* preferência só desta sessão */
  }
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {text.split("\n\n").map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Convite                                                              */
/* ------------------------------------------------------------------ */

function InviteView({ invite, onDismiss }: { invite: StudyInvite; onDismiss: () => void }) {
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function accept() {
    setBusy(true)
    try {
      const res = await fetch("/api/studies/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: invite.code, consent: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Não foi possível aceitar o convite.")
      clearPendingInvite()
      await refreshStudyMe()
      toast.success("Participação confirmada. Bom teste!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível aceitar o convite.")
    } finally {
      setBusy(false)
    }
  }

  // Convite por e-mail: recusar faz ele deixar de aparecer em qualquer acesso.
  async function decline() {
    setBusy(true)
    try {
      const res = await fetch("/api/studies/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: invite.code }),
      })
      if (!res.ok) throw new Error("Não foi possível recusar o convite.")
      onDismiss()
      await refreshStudyMe()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível recusar o convite.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed">
      {invite.source === "email" && (
        <p className="rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary">
          A equipe do FlowBot convidou a sua conta para esta avaliação.
        </p>
      )}
      <Paragraphs text={invite.intro} />
      <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
        <p className="font-medium text-foreground">Termo de participação</p>
        <div className="text-muted-foreground">
          <Paragraphs text={invite.privacy} />
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5">
        <Checkbox
          id="study-consent"
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          className="mt-0.5"
        />
        <span>Li o termo e concordo em participar desta avaliação.</span>
      </label>
      <div className="flex flex-col gap-2">
        <Button disabled={!consent || busy} onClick={() => void accept()}>
          {busy && <LoaderCircleIcon className="animate-spin" />}
          Aceitar e começar
        </Button>
        <Button variant="ghost" className="text-muted-foreground" onClick={onDismiss}>
          Agora não
        </Button>
        {invite.source === "email" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void decline()}
            className="self-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Não quero participar
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tarefas                                                              */
/* ------------------------------------------------------------------ */

function TaskItem({
  task,
  index,
  locked,
  onToggle,
}: {
  task: StudyTaskStatus
  index: number
  locked: boolean
  onToggle: (task: StudyTaskStatus, done: boolean) => void
}) {
  const done = task.completedAt !== null
  const autoDone = task.method === "auto"
  const id = `study-task-${task.key}`

  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl border p-3 transition-colors",
        done ? "border-transparent bg-emerald-50 dark:bg-emerald-950/30" : "border-border bg-card"
      )}
    >
      <Checkbox
        id={id}
        checked={done}
        disabled={locked || autoDone}
        onCheckedChange={(v) => onToggle(task, v === true)}
        className="mt-0.5"
        aria-label={`Marcar “${task.title}” como concluída`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-foreground">
            {index + 1}. {task.title}
          </label>
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
            <ClockIcon className="size-3" aria-hidden />
            {task.minutes} min
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-foreground/90">{task.goal}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">Concluída quando</span>{" "}
          {task.doneWhen}
        </p>
        {done && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {autoDone ? <SparklesIcon className="size-3" aria-hidden /> : <CheckCircle2Icon className="size-3" aria-hidden />}
            {autoDone ? "Reconhecida automaticamente pelo FlowBot" : "Marcada por você"}
          </p>
        )}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Questionário                                                         */
/* ------------------------------------------------------------------ */

function Questionnaire({
  participation,
  allTasksDone,
}: {
  participation: StudyParticipation
  allTasksDone: boolean
}) {
  const [sus, setSus] = useState<(number | null)[]>(() => SUS_ITEMS.map(() => null))
  const [open, setOpen] = useState<Record<string, string>>({})
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const missing = sus.filter((v) => v === null).length

  if (participation.submittedAt) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-emerald-50 px-4 py-8 text-center dark:bg-emerald-950/30">
        <CheckCircle2Icon className="size-10 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <p className="text-base font-semibold text-foreground">Questionário enviado. Muito obrigado!</p>
        <p className="text-sm text-muted-foreground">
          Sua participação foi registrada. Você pode continuar usando o FlowBot normalmente.
        </p>
      </div>
    )
  }

  async function submit() {
    if (missing > 0) {
      toast.error(`Falta${missing > 1 ? "m" : ""} ${missing} afirmaç${missing > 1 ? "ões" : "ão"} da escala.`)
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/studies/me/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sus, open, profile }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar o questionário.")
      await refreshStudyMe()
      toast.success("Questionário enviado. Obrigado!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o questionário.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-5 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      {!allTasksDone && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          O ideal é responder depois de passar por todas as tarefas, mesmo as que não conseguiu concluir.
        </p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold text-foreground">Parte 1 · Escala de usabilidade (SUS)</legend>
        <p className="text-xs text-muted-foreground">
          Para cada afirmação, marque de 1 (discordo totalmente) a 5 (concordo totalmente), pensando
          na experiência que acabou de ter.
        </p>
        {SUS_ITEMS.map((item, i) => (
          <div key={item} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
            <p id={`sus-${i}`} className="text-[13px] text-foreground">
              <span className="mr-1 font-mono text-xs text-muted-foreground">{i + 1}.</span>
              {item}
            </p>
            <div role="radiogroup" aria-labelledby={`sus-${i}`} className="grid grid-cols-5 gap-1">
              {SUS_SCALE.map((option) => {
                const selected = sus[i] === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={option.label}
                    onClick={() => setSus((s) => s.map((v, j) => (j === i ? option.value : v)))}
                    className={cn(
                      "rounded-lg border py-1.5 text-sm font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary/50"
                    )}
                  >
                    {option.value}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Discordo totalmente</span>
              <span>Concordo totalmente</span>
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold text-foreground">Parte 2 · Sua opinião</legend>
        {OPEN_QUESTIONS.map((q) => (
          <div key={q.key} className="flex flex-col gap-1.5">
            <label htmlFor={`open-${q.key}`} className="text-[13px] text-foreground">{q.label}</label>
            <Textarea
              id={`open-${q.key}`}
              rows={2}
              maxLength={2000}
              value={open[q.key] ?? ""}
              onChange={(e) => setOpen((o) => ({ ...o, [q.key]: e.target.value }))}
            />
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold text-foreground">Parte 3 · Sobre você</legend>
        {PROFILE_QUESTIONS.map((q) => (
          <div key={q.key} className="flex flex-col gap-1.5">
            <label htmlFor={`profile-${q.key}`} className="text-[13px] text-foreground">{q.label}</label>
            <select
              id={`profile-${q.key}`}
              value={profile[q.key] ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, [q.key]: e.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="">Prefiro não informar</option>
              {q.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        ))}
      </fieldset>

      <Button type="submit" disabled={busy}>
        {busy && <LoaderCircleIcon className="animate-spin" />}
        Enviar questionário
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        O envio é único. Depois dele, as respostas não podem ser alteradas.
      </p>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Painel                                                               */
/* ------------------------------------------------------------------ */

/**
 * Guia do participante: painel fixo à direita para quem aceitou um convite de avaliação
 * de usabilidade (ou tem um convite pendente). Some para os demais usuários.
 */
export function ParticipantPanel() {
  const isClient = useIsClient()
  const pathname = usePathname()
  const { data } = useStudyMe()
  const [open, setOpen] = useState(readOpen)
  const [tab, setTab] = useState<Tab>("tarefas")
  const [dismissed, setDismissed] = useState(false)

  const participation = data?.participation ?? null
  const invite = !participation && !dismissed ? data?.invite ?? null : null

  // Atualiza o progresso ao trocar de tela e, com o painel aberto, a cada 15 s.
  useEffect(() => {
    if (participation || readPendingInvite()) void refreshStudyMe()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só a mudança de tela importa aqui
  }, [pathname])

  const pending = participation && !participation.submittedAt
  useEffect(() => {
    if (!pending || !open) return
    const timer = window.setInterval(() => void refreshStudyMe(), 15000)
    return () => window.clearInterval(timer)
  }, [pending, open])

  if (!isClient || (!participation && !invite)) return null

  const doneCount = participation?.tasks.filter((t) => t.completedAt).length ?? 0
  const total = participation?.tasks.length ?? 0
  const allTasksDone = total > 0 && doneCount === total

  function toggle(next: boolean) {
    setOpen(next)
    writeOpen(next)
  }

  async function toggleTask(task: StudyTaskStatus, done: boolean) {
    try {
      const res = await fetch("/api/studies/me/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskKey: task.key, done }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Não foi possível marcar a tarefa.")
      if (data) setStudyMe({ ...data, participation: body.participation })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível marcar a tarefa.")
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "tarefas", label: "Tarefas" },
    { key: "comecar", label: "Como começar" },
    { key: "questionario", label: "Questionário" },
    { key: "privacidade", label: "Privacidade" },
  ]

  const collapsedTab = (
    <button
      type="button"
      onClick={() => toggle(true)}
      className="fixed top-1/2 right-0 z-[60] flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl border border-r-0 border-primary/30 bg-primary px-2 py-3 text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label="Abrir o guia do participante"
    >
      <ClipboardCheckIcon className="size-4" aria-hidden />
      <span className="text-xs font-semibold [writing-mode:vertical-rl]">Guia do participante</span>
      {participation && (
        <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[11px] font-semibold tabular-nums">
          {doneCount}/{total}
        </span>
      )}
    </button>
  )

  const panel = (
    <aside
      className="animate-fade-in-up fixed top-0 right-0 z-[60] flex h-dvh w-full flex-col border-l border-border bg-background shadow-2xl sm:w-[24rem]"
      aria-label="Guia do participante"
    >
      <header className="flex flex-col gap-3 border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-primary uppercase">Guia do participante</p>
            <p className="truncate text-sm font-semibold text-foreground">
              {participation?.study.title ?? invite?.title}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="-mt-1 -mr-1 size-8 shrink-0 text-muted-foreground"
            aria-label="Recolher o guia"
            onClick={() => toggle(false)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        {participation && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span
                  className="block h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }}
                />
              </div>
              <span className="tabular-nums">
                {doneCount} de {total} tarefas
              </span>
            </div>
            <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Seções do guia">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-current={tab === t.key ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    tab === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                  {t.key === "questionario" && participation.submittedAt && " ✓"}
                </button>
              ))}
            </nav>
          </>
        )}
      </header>

      <div key={participation ? tab : "convite"} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {invite && (
          <InviteView
            invite={invite}
            onDismiss={() => {
              clearPendingInvite()
              setDismissed(true)
            }}
          />
        )}

        {participation && tab === "tarefas" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Cada tarefa diz o objetivo, não o caminho. O FlowBot marca sozinho o que reconhece; se
              algo concluído não for marcado, marque você mesmo.
            </p>
            <ol className="flex flex-col gap-2">
              {participation.tasks.map((task, i) => (
                <TaskItem
                  key={task.key}
                  task={task}
                  index={i}
                  locked={Boolean(participation.submittedAt)}
                  onToggle={(t, done) => void toggleTask(t, done)}
                />
              ))}
            </ol>
            {!participation.submittedAt && (
              <Button variant={allTasksDone ? "default" : "outline"} onClick={() => setTab("questionario")}>
                {allTasksDone ? "Tudo pronto: responder ao questionário" : "Ir para o questionário"}
              </Button>
            )}
          </div>
        )}

        {participation && tab === "comecar" && (
          <div className="flex flex-col gap-3 text-sm leading-relaxed">
            <Paragraphs text={participation.study.intro} />
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-foreground/90">
              {GETTING_STARTED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {participation && tab === "questionario" && (
          <Questionnaire participation={participation} allTasksDone={allTasksDone} />
        )}

        {participation && tab === "privacidade" && (
          <div className="text-sm leading-relaxed text-foreground/90">
            <Paragraphs text={participation.study.privacy} />
          </div>
        )}
      </div>

      {(participation?.study.contact ?? invite?.contact) && (
        <footer className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          {participation?.study.contact ?? invite?.contact}
        </footer>
      )}
    </aside>
  )

  return createPortal(open || invite ? panel : collapsedTab, document.body)
}
