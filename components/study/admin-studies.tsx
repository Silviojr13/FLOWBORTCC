"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  CopyIcon,
  DownloadIcon,
  LoaderCircleIcon,
  MailIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  OPEN_QUESTIONS,
  STUDY_TASKS,
  SUS_ITEMS,
  SUS_TARGET,
  susRating,
} from "@/lib/study"
import type { StudyResults } from "@/lib/study-results"
import { inviteUrl as buildInviteUrl } from "@/lib/site"

interface StudySummary {
  id: string
  title: string
  intro: string
  privacy: string
  contact: string | null
  inviteCode: string
  status: string
  createdAt: string
  joined?: number
  submitted?: number
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-destructive"
        )}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV anônimo (P01, P02…) com SUS, tempos das tarefas, perfil e respostas abertas. */
function resultsToCsv(results: StudyResults) {
  const headers = [
    "Participante",
    "Aceite",
    "Envio",
    "Nota SUS",
    ...SUS_ITEMS.map((_, i) => `SUS ${i + 1}`),
    ...STUDY_TASKS.map((t) => `${t.title} (min)`),
    ...STUDY_TASKS.map((t) => `${t.title} (marcação)`),
    "Área",
    "Experiência",
    "Ferramenta",
    ...OPEN_QUESTIONS.map((q) => q.label),
  ]
  const rows = results.participants.map((p) => [
    p.label,
    p.consentAt,
    p.submittedAt,
    p.susScore,
    ...SUS_ITEMS.map((_, i) => p.sus?.[i] ?? null),
    ...STUDY_TASKS.map((t) => p.taskMinutes[t.key]),
    ...STUDY_TASKS.map((t) => p.taskMethods[t.key]),
    p.profile.area,
    p.profile.experiencia,
    p.profile.ferramentas,
    ...OPEN_QUESTIONS.map((q) => p.open[q.key]),
  ])
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n"
}

/* ------------------------------------------------------------------ */

interface EmailInvitation {
  id: string
  email: string
  invitedAt: string
  status: "pendente" | "aceito" | "recusado"
  hasAccount: boolean
}

const INVITATION_STATUS: Record<EmailInvitation["status"], { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300" },
  aceito: { label: "Aceito", className: "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300" },
  recusado: { label: "Recusado", className: "border-border text-muted-foreground" },
}

/**
 * Convite por e-mail: o admin digita o e-mail exato e o convite aparece dentro do FlowBot
 * para essa conta (ou quando ela for criada). Não há busca nem lista de contas cadastradas.
 */
function EmailInvites({ studyId, open }: { studyId: string; open: boolean }) {
  const [invitations, setInvitations] = useState<EmailInvitation[]>([])
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/studies/${studyId}/invitations`)
      .then((r) => r.json())
      .then((data) => !cancelled && setInvitations(data.invitations ?? []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [studyId])

  async function invite() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/studies/${studyId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Não foi possível convidar.")
      const created: EmailInvitation = data.invitation
      setInvitations((list) => [created, ...list.filter((i) => i.id !== created.id)])
      setEmail("")
      toast.success(
        created.hasAccount
          ? "Convite enviado. Ele aparece para a pessoa no próximo acesso ao FlowBot."
          : "Convite registrado. Ele aparece quando a pessoa criar a conta com este e-mail."
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível convidar.")
    } finally {
      setBusy(false)
    }
  }

  async function cancel(invitation: EmailInvitation) {
    const res = await fetch(`/api/admin/studies/${studyId}/invitations/${invitation.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Não foi possível cancelar o convite.")
      return
    }
    setInvitations((list) => list.filter((i) => i.id !== invitation.id))
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">Convidar por e-mail</h2>
        <p className="text-xs text-muted-foreground">
          Digite o e-mail exato da pessoa. O convite aparece para ela dentro do FlowBot, no guia do
          participante. Por privacidade, o FlowBot não lista nem sugere as contas cadastradas.
        </p>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          void invite()
        }}
      >
        <Input
          id="study-invite-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="pessoa@exemplo.com"
          value={email}
          disabled={!open}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="E-mail da pessoa convidada"
        />
        <Button type="submit" disabled={!open || busy || !email.trim()}>
          {busy ? <LoaderCircleIcon className="animate-spin" /> : <MailIcon />}
          Convidar
        </Button>
      </form>
      {!open && <p className="text-xs text-muted-foreground">Reabra a avaliação para convidar pessoas.</p>}

      {invitations.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {invitations.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{inv.email}</span>
              <span className="text-xs text-muted-foreground">
                {inv.hasAccount ? "conta encontrada" : "ainda sem conta"}
              </span>
              <Badge variant="outline" className={INVITATION_STATUS[inv.status].className}>
                {INVITATION_STATUS[inv.status].label}
              </Badge>
              {inv.status !== "aceito" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  aria-label={`Cancelar o convite de ${inv.email}`}
                  onClick={() => void cancel(inv)}
                >
                  <XIcon className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function StudyDetail({ study, onChanged }: { study: StudySummary; onChanged: (s: StudySummary) => void }) {
  const [results, setResults] = useState<StudyResults | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [draft, setDraft] = useState({ title: study.title, intro: study.intro, privacy: study.privacy, contact: study.contact ?? "" })
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  // Sempre o domínio publicado (flowbottcc.vercel.app), mesmo acessando pelo localhost.
  const inviteUrl = buildInviteUrl(study.inviteCode)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/studies/${study.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.results) setResults(data.results)
      })
      .catch(() => !cancelled && toast.error("Não foi possível carregar os resultados."))
    return () => {
      cancelled = true
    }
  }, [study.id, refreshToken])

  async function patch(data: Record<string, string>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/studies/${study.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Não foi possível salvar.")
      onChanged({ ...study, ...body.study })
      toast.success("Avaliação atualizada.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }

  async function removeParticipant(id: string) {
    const res = await fetch(`/api/admin/studies/${study.id}/participants/${id}`, { method: "DELETE" })
    setConfirmRemove(null)
    if (!res.ok) {
      toast.error("Não foi possível remover a participação.")
      return
    }
    setRefreshToken((t) => t + 1)
  }

  function exportCsv() {
    if (!results) return
    const blob = new Blob([resultsToCsv(results)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `avaliacao-flowbot-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success("Link de convite copiado.")
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.")
    }
  }

  const mean = results?.sus.mean ?? null
  const rating = mean !== null ? susRating(mean) : null

  return (
    <div className="flex flex-col gap-8">
      {/* Convite e status */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{study.title}</h2>
            <Badge variant={study.status === "aberta" ? "default" : "secondary"}>
              {study.status === "aberta" ? "Aberta" : "Encerrada"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setRefreshToken((t) => t + 1)}>
              <RefreshCwIcon />
              Atualizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void patch({ status: study.status === "aberta" ? "encerrada" : "aberta" })}
            >
              {study.status === "aberta" ? "Encerrar avaliação" : "Reabrir avaliação"}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs select-all">
            {inviteUrl}
          </code>
          <Button size="sm" onClick={() => void copyInvite()}>
            <CopyIcon />
            Copiar link de convite
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Envie este link aos participantes. Quem abrir cria a conta (ou entra) e aceita o termo no
          guia do participante, que aparece à direita dentro do FlowBot.
        </p>
      </div>

      <EmailInvites studyId={study.id} open={study.status === "aberta"} />

      {!results ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Carregando resultados...</p>
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Participantes" value={String(results.joined)} hint="aceitaram o convite" />
            <Kpi
              label="Questionários enviados"
              value={String(results.submitted)}
              hint={results.joined ? `${Math.round((results.submitted / results.joined) * 100)}% dos participantes` : undefined}
            />
            <Kpi
              label="Nota SUS média"
              value={mean !== null ? mean.toLocaleString("pt-BR") : "—"}
              hint={rating ? `${rating.label} · meta ≥ ${SUS_TARGET}` : `meta ≥ ${SUS_TARGET}`}
              tone={rating?.tone}
            />
            <Kpi
              label="Mediana · desvio padrão"
              value={results.sus.median !== null ? results.sus.median.toLocaleString("pt-BR") : "—"}
              hint={
                results.sus.min !== null
                  ? `DP ${results.sus.sd?.toLocaleString("pt-BR") ?? "—"} · de ${results.sus.min} a ${results.sus.max}`
                  : "aguardando respostas"
              }
            />
          </div>

          {mean !== null && (
            <div className="flex flex-col gap-1.5">
              <div className="relative h-3 rounded-full bg-gradient-to-r from-red-400/50 via-amber-300/60 to-emerald-400/60" aria-hidden>
                <span className="absolute top-[-4px] h-5 w-0.5 bg-foreground/60" style={{ left: `${SUS_TARGET}%` }} />
                <span
                  className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
                  style={{ left: `${mean}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>0</span>
                <span>meta {SUS_TARGET}</span>
                <span>100</span>
              </div>
            </div>
          )}

          {/* Tarefas */}
          <Section title="Conclusão das tarefas">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Tarefa</th>
                    <th className="px-3 py-2 text-right font-medium">Concluíram</th>
                    <th className="px-3 py-2 text-left font-medium">Taxa</th>
                    <th className="px-3 py-2 text-right font-medium">Auto · manual</th>
                    <th className="px-3 py-2 text-right font-medium">Tempo mediano</th>
                  </tr>
                </thead>
                <tbody>
                  {results.tasks.map((t, i) => (
                    <tr key={t.key} className="border-t border-border">
                      <td className="px-3 py-2">{i + 1}. {t.title}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.completed}/{results.joined}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${t.rate}%` }} />
                          </span>
                          <span className="tabular-nums">{t.rate}%</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{t.auto} · {t.manual}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.medianMinutes !== null ? `${t.medianMinutes.toLocaleString("pt-BR")} min` : "—"}
                        <span className="text-xs text-muted-foreground"> / {STUDY_TASKS[i].minutes} prev.</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Tempo de cada tarefa: intervalo desde a conclusão anterior (ou o aceite do termo).
            </p>
          </Section>

          {/* SUS por afirmação */}
          <Section title="Escala SUS por afirmação">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Afirmação</th>
                    <th className="px-3 py-2 text-right font-medium">Média (1–5)</th>
                    <th className="px-3 py-2 text-left font-medium">Ideal</th>
                  </tr>
                </thead>
                <tbody>
                  {SUS_ITEMS.map((item, i) => (
                    <tr key={item} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2">{item}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {results.itemMeans[i]?.toLocaleString("pt-BR") ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                        {i % 2 === 0 ? "alto (positiva)" : "baixo (negativa)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Perfil */}
          <Section title="Perfil dos participantes">
            <div className="grid gap-3 md:grid-cols-3">
              {results.profile.map((q) => (
                <div key={q.key} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">{q.label}</p>
                  {Object.keys(q.counts).length === 0 ? (
                    <p className="text-muted-foreground">Sem respostas.</p>
                  ) : (
                    Object.entries(q.counts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([option, count]) => (
                        <p key={option} className="flex justify-between gap-2">
                          <span>{option}</span>
                          <span className="font-medium tabular-nums">{count}</span>
                        </p>
                      ))
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Respostas abertas */}
          <Section title="Respostas abertas">
            <div className="flex flex-col gap-3">
              {OPEN_QUESTIONS.map((q) => {
                const answers = results.participants.filter((p) => p.open[q.key])
                return (
                  <div key={q.key} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                    <p className="text-sm font-medium text-foreground">{q.label}</p>
                    {answers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem respostas ainda.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5 text-sm">
                        {answers.map((p) => (
                          <li key={p.id} className="flex gap-2">
                            <span className="shrink-0 font-mono text-xs text-muted-foreground">{p.label}</span>
                            <span className="whitespace-pre-wrap">{p.open[q.key]}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Participantes */}
          <Section
            title="Participantes"
            action={
              <Button size="sm" variant="outline" disabled={results.joined === 0} onClick={exportCsv}>
                <DownloadIcon />
                Exportar CSV
              </Button>
            }
          >
            {results.participants.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Ninguém aceitou o convite ainda. Envie o link acima aos participantes.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Participante</th>
                      <th className="px-3 py-2 text-left font-medium">Aceite</th>
                      <th className="px-3 py-2 text-right font-medium">Tarefas</th>
                      <th className="px-3 py-2 text-right font-medium">Nota SUS</th>
                      <th className="px-3 py-2" aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {results.participants.map((p) => {
                      const done = Object.values(p.taskMinutes).filter((m) => m !== null).length
                      return (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{p.label}</td>
                          <td className="px-3 py-2 text-muted-foreground">{dateTime(p.consentAt)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{done}/{STUDY_TASKS.length}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {p.susScore !== null ? p.susScore.toLocaleString("pt-BR") : <span className="font-normal text-muted-foreground">pendente</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {confirmRemove === p.id ? (
                              <span className="flex justify-end gap-1">
                                <Button size="sm" variant="destructive" onClick={() => void removeParticipant(p.id)}>
                                  Remover
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                                  Cancelar
                                </Button>
                              </span>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                aria-label={`Remover a participação ${p.label}`}
                                onClick={() => setConfirmRemove(p.id)}
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Remover uma participação apaga só o progresso e as respostas desta avaliação (útil para
              descartar testes da equipe). A conta e os projetos da pessoa continuam intactos.
            </p>
          </Section>
        </>
      )}

      {/* Textos */}
      <Section title="Textos exibidos ao participante">
        <form
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void patch(draft)
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Título</span>
            <Input id="study-title" value={draft.title} maxLength={120} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Apresentação (parágrafos separados por linha em branco)</span>
            <Textarea id="study-intro" rows={5} value={draft.intro} onChange={(e) => setDraft((d) => ({ ...d, intro: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Termo de participação e privacidade</span>
            <Textarea id="study-privacy" rows={6} value={draft.privacy} onChange={(e) => setDraft((d) => ({ ...d, privacy: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Contato da equipe</span>
            <Input id="study-contact" value={draft.contact} maxLength={300} onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))} />
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircleIcon className="animate-spin" />}
              Salvar textos
            </Button>
          </div>
        </form>
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function AdminStudies() {
  const [studies, setStudies] = useState<StudySummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    return fetch("/api/admin/studies")
      .then((r) => r.json())
      .then((data) => {
        const list: StudySummary[] = data.studies ?? []
        setStudies(list)
        setSelectedId((current) => current ?? list[0]?.id ?? null)
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/studies")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const list: StudySummary[] = data.studies ?? []
        setStudies(list)
        setSelectedId(list[0]?.id ?? null)
      })
      .catch(() => !cancelled && toast.error("Não foi possível carregar as avaliações."))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  async function create() {
    setCreating(true)
    try {
      const res = await fetch("/api/admin/studies", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Não foi possível criar a avaliação.")
      await load()
      setSelectedId(data.study.id)
      toast.success("Avaliação criada. Copie o link de convite para enviar aos participantes.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a avaliação.")
    } finally {
      setCreating(false)
    }
  }

  const selected = studies.find((s) => s.id === selectedId) ?? null

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {studies.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedId(s.id)}
            className={cn(
              "flex flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              s.id === selectedId ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:bg-accent"
            )}
          >
            <span className="font-medium">{s.title}</span>
            <span className="text-xs text-muted-foreground">
              {s.status === "aberta" ? "Aberta" : "Encerrada"} · {s.joined ?? 0} participante(s) · {s.submitted ?? 0} questionário(s)
            </span>
          </button>
        ))}
        <Button variant={studies.length ? "outline" : "default"} disabled={creating} onClick={() => void create()}>
          {creating ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
          Nova avaliação
        </Button>
      </div>

      {selected ? (
        <StudyDetail
          key={selected.id}
          study={selected}
          onChanged={(s) => setStudies((list) => list.map((x) => (x.id === s.id ? { ...x, ...s } : x)))}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Crie uma avaliação para gerar o link de convite. Os participantes recebem o guia, as
          tarefas e o questionário SUS dentro do FlowBot, e os resultados aparecem aqui.
        </div>
      )}
    </div>
  )
}
