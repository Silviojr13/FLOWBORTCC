"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  BookCheckIcon,
  ClockIcon,
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  GraduationCapIcon,
  LoaderCircleIcon,
  NetworkIcon,
  PaperclipIcon,
  PencilIcon,
  SettingsIcon,
  SparklesIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DocMarkdown } from "@/components/docs/doc-markdown"
import { downloadDocMarkdown, downloadDocPdf } from "@/lib/doc-export"
import type { DocSectionView, DocSettings, DocSummary, DocView } from "@/lib/docs"
import { cn } from "@/lib/utils"

type ApiResult<T> = { ok: boolean; status: number; body: T & { error?: string; retryAfter?: number | null } }

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const isForm = init?.body instanceof FormData
  const res = await fetch(url, {
    ...init,
    headers: init?.body && !isForm ? { "Content-Type": "application/json" } : undefined,
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

const KIND_BADGE: Record<DocSectionView["kind"], { label: string; icon: typeof SparklesIcon }> = {
  ia: { label: "Texto (IA)", icon: SparklesIcon },
  dados: { label: "Dados do projeto", icon: DatabaseIcon },
  diagrama: { label: "Diagrama", icon: NetworkIcon },
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

/**
 * Aba Documentação: os documentos de engenharia do projeto, cada um na estrutura da sua norma.
 * As tabelas saem dos dados, os diagramas da aba Diagramas e o texto é escrito pela IA.
 */
export function DocsWorkspace({ projectId, projectName }: Readonly<{ projectId: string; projectName: string }>) {
  const [documents, setDocuments] = useState<DocSummary[] | null>(null)
  const [settings, setSettings] = useState<DocSettings | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [openType, setOpenType] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    request<{ documents: DocSummary[]; settings: DocSettings; canEdit: boolean }>(`/api/projects/${projectId}/docs`)
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) {
          toast.error(body.error || "Não foi possível carregar a documentação.")
          return
        }
        setDocuments(body.documents)
        setSettings(body.settings)
        setCanEdit(body.canEdit)
      })
      .catch(() => !cancelled && toast.error("Não foi possível carregar a documentação."))
    return () => {
      cancelled = true
    }
  }, [projectId, reloadToken])

  if (!documents || !settings) return <p className="text-sm text-muted-foreground">Carregando...</p>

  const settingsDialog = (
    <SettingsDialog
      projectId={projectId}
      open={settingsOpen}
      settings={settings}
      onOpenChange={setSettingsOpen}
      onSaved={(next) => setSettings(next)}
    />
  )

  if (openType) {
    return (
      <>
        <DocumentView
          projectId={projectId}
          projectName={projectName}
          type={openType}
          settings={settings}
          canEdit={canEdit}
          onBack={() => {
            setOpenType(null)
            setReloadToken((t) => t + 1)
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {settingsDialog}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {canEdit && !settings.configured ? (
        <section
          className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center"
          data-tour="docs-settings"
        >
          <GraduationCapIcon className="size-6 shrink-0 text-primary" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">Antes de começar: esta documentação é uma entrega acadêmica?</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Informe a instituição, os autores e, se houver, anexe o modelo de referência (o modelo da instituição, a
              rubrica da avaliação ou um exemplo). A IA segue a estrutura dele ao escrever.
            </p>
          </div>
          <Button onClick={() => setSettingsOpen(true)} className="gap-1.5">
            <SettingsIcon />
            Definir diretrizes
          </Button>
        </section>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-tour="docs-settings">
          {settings.academic ? (
            <Badge variant="secondary" className="gap-1">
              <GraduationCapIcon className="size-3" />
              Entrega acadêmica{settings.institution ? ` · ${settings.institution}` : ""}
            </Badge>
          ) : (
            <Badge variant="outline">Documentação técnica</Badge>
          )}
          {settings.referenceName && (
            <Badge variant="outline" className="gap-1">
              <PaperclipIcon className="size-3" />
              Modelo: {settings.referenceName}
            </Badge>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon className="size-3.5" />
              Diretrizes
            </Button>
          )}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-tour="docs-list">
        {documents.map((doc) => {
          const pct = doc.total ? Math.round((doc.written / doc.total) * 100) : 100
          return (
            <li key={doc.type}>
              <button
                type="button"
                onClick={() => setOpenType(doc.type)}
                className="flex h-full w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <span className="flex items-start gap-2">
                  <FileTextIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-sm font-medium text-foreground">{doc.title}</span>
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">{doc.standard}</span>
                <span className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="tabular-nums">
                    {doc.total ? `${doc.written}/${doc.total} seções` : "Só dados"} · v{doc.version}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Os documentos seguem as normas internacionais ISO/IEC/IEEE (adotadas no Brasil pela ABNT). Tabelas de requisitos,
        rastreabilidade, componentes, sprints e equipe vêm direto dos dados do projeto e se atualizam sozinhas; os diagramas
        vêm da aba Diagramas.
      </p>
      {settingsDialog}
    </div>
  )
}

/* ---------------------------------------------------------------- documento */

function DocumentView({
  projectId,
  projectName,
  type,
  settings,
  canEdit,
  onBack,
  onOpenSettings,
}: Readonly<{
  projectId: string
  projectName: string
  type: string
  settings: DocSettings
  canEdit: boolean
  onBack: () => void
  onOpenSettings: () => void
}>) {
  const [doc, setDoc] = useState<DocView | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [writing, setWriting] = useState<string | null>(null)
  const [queueInfo, setQueueInfo] = useState<{ index: number; total: number } | null>(null)
  const [waitSeconds, setWaitSeconds] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [exporting, setExporting] = useState<"pdf" | "md" | null>(null)
  const stopRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    request<{ document: DocView }>(`/api/projects/${projectId}/docs/${type}`)
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) toast.error(body.error || "Não foi possível abrir o documento.")
        else setDoc(body.document)
      })
      .catch(() => !cancelled && toast.error("Não foi possível abrir o documento."))
    return () => {
      cancelled = true
    }
  }, [projectId, type, reloadToken])

  useEffect(
    () => () => {
      stopRef.current = true
    },
    []
  )

  /** Escreve as seções em sequência; no limite por minuto, espera e continua. */
  const writeSections = useCallback(
    async (keys: string[], instructions?: string) => {
      stopRef.current = false
      for (const [index, key] of keys.entries()) {
        if (stopRef.current) break
        setWriting(key)
        setQueueInfo(keys.length > 1 ? { index: index + 1, total: keys.length } : null)
        let done = false
        while (!done && !stopRef.current) {
          const { ok, status, body } = await request<{ content: string }>(
            `/api/projects/${projectId}/docs/${type}/sections/${key}`,
            { method: "POST", body: JSON.stringify({ instructions }) }
          )
          if (ok) {
            setDoc((d) =>
              d ? { ...d, sections: d.sections.map((s) => (s.key === key ? { ...s, content: body.content, source: "ia", updatedAt: new Date().toISOString() } : s)) } : d
            )
            done = true
          } else if (status === 429) {
            let seconds = Math.min(Math.max(Math.ceil(Number(body.retryAfter) || 20), 3), 90)
            while (seconds > 0 && !stopRef.current) {
              setWaitSeconds(seconds)
              await new Promise((r) => setTimeout(r, 1000))
              seconds -= 1
            }
            setWaitSeconds(0)
          } else {
            toast.error(body.error || "Não foi possível escrever a seção.")
            stopRef.current = true
          }
        }
      }
      setWriting(null)
      setQueueInfo(null)
    },
    [projectId, type]
  )

  if (!doc) return <p className="text-sm text-muted-foreground">Carregando o documento...</p>

  const textSections = doc.sections.filter((s) => s.kind === "ia")
  const empty = textSections.filter((s) => !s.content.trim()).map((s) => s.key)
  const busy = writing !== null
  const writingTitle = doc.sections.find((s) => s.key === writing)?.title

  async function exportAs(format: "pdf" | "md") {
    if (!doc) return
    setExporting(format)
    try {
      if (format === "pdf") await downloadDocPdf(doc, { projectName, settings })
      else downloadDocMarkdown(doc, { projectName, settings })
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível exportar o documento.")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={onBack} disabled={busy}>
          <ArrowLeftIcon />
          Documentos
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2" data-tour="docs-actions">
          {canEdit &&
            (busy ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => (stopRef.current = true)}>
                <SquareIcon className="size-3.5" />
                Pausar
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={textSections.length === 0}
                onClick={() => {
                  const keys = empty.length > 0 ? empty : textSections.map((s) => s.key)
                  if (empty.length === 0 && !window.confirm("Todas as seções já foram escritas. Reescrever o documento inteiro?")) return
                  void writeSections(keys)
                }}
              >
                <SparklesIcon />
                {empty.length === textSections.length ? "Escrever com a IA" : empty.length > 0 ? `Escrever ${empty.length} seção(ões) vazia(s)` : "Reescrever tudo"}
              </Button>
            ))}
          {canEdit && (
            <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => setPublishOpen(true)}>
              <BookCheckIcon />
              Publicar versão
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy || exporting !== null} onClick={() => void exportAs("pdf")}>
            {exporting === "pdf" ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
            PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy || exporting !== null} onClick={() => void exportAs("md")}>
            <DownloadIcon />
            Markdown
          </Button>
        </div>
      </div>

      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <h2 className="text-lg font-semibold text-foreground">{doc.title}</h2>
        <p className="text-sm text-muted-foreground">{doc.purpose}</p>
        <p className="text-xs text-muted-foreground">
          Estrutura conforme {doc.standard} · versão {doc.version}
          {doc.revisions.length > 0 && ` · última revisão em ${dateTime.format(new Date(doc.revisions[doc.revisions.length - 1].date))}`}
        </p>
        {canEdit && !settings.configured && (
          <button type="button" onClick={onOpenSettings} className="self-start text-xs text-primary hover:underline">
            É uma entrega acadêmica ou tem um modelo a seguir? Defina as diretrizes antes de escrever.
          </button>
        )}
      </header>

      {busy && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {waitSeconds > 0 ? (
            <>
              <ClockIcon className="size-3.5" />
              Limite por minuto da IA: continuando em {waitSeconds}s...
            </>
          ) : (
            <>
              <LoaderCircleIcon className="size-3.5 animate-spin" />
              Escrevendo {queueInfo ? `${queueInfo.index} de ${queueInfo.total}: ` : ""}
              {writingTitle}...
            </>
          )}
        </p>
      )}

      <ol className="flex flex-col gap-4">
        {doc.sections.map((section, index) => (
          <SectionCard
            key={section.key}
            projectId={projectId}
            type={type}
            number={index + 1}
            section={section}
            canEdit={canEdit}
            busy={busy}
            isWriting={writing === section.key}
            isEditing={editing === section.key}
            onEdit={() => setEditing(section.key)}
            onCancelEdit={() => setEditing(null)}
            onSaved={(content) => {
              setDoc((d) => (d ? { ...d, sections: d.sections.map((s) => (s.key === section.key ? { ...s, content, source: "manual" } : s)) } : d))
              setEditing(null)
            }}
            onWrite={(instructions) => void writeSections([section.key], instructions)}
          />
        ))}
      </ol>

      <PublishDialog
        open={publishOpen}
        version={doc.version}
        onOpenChange={setPublishOpen}
        onPublish={async (note) => {
          const { ok, body } = await request<{ version: string }>(`/api/projects/${projectId}/docs/${type}`, {
            method: "PATCH",
            body: JSON.stringify({ publish: note }),
          })
          if (!ok) {
            toast.error(body.error || "Não foi possível publicar a versão.")
            return false
          }
          toast.success(`Versão ${body.version} publicada.`)
          setReloadToken((t) => t + 1)
          return true
        }}
      />
    </div>
  )
}

function SectionCard({
  projectId,
  type,
  number,
  section,
  canEdit,
  busy,
  isWriting,
  isEditing,
  onEdit,
  onCancelEdit,
  onSaved,
  onWrite,
}: Readonly<{
  projectId: string
  type: string
  number: number
  section: DocSectionView
  canEdit: boolean
  busy: boolean
  isWriting: boolean
  isEditing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSaved: (content: string) => void
  onWrite: (instructions?: string) => void
}>) {
  const [draft, setDraft] = useState(section.content)
  const [saving, setSaving] = useState(false)
  const [askInstructions, setAskInstructions] = useState(false)
  const [instructions, setInstructions] = useState("")
  const badge = KIND_BADGE[section.kind]
  const BadgeIcon = badge.icon
  const title = /^\d/.test(section.title) ? section.title : `${number}. ${section.title}`
  const hasContent = Boolean(section.content.trim())

  async function save() {
    setSaving(true)
    const { ok, body } = await request(`/api/projects/${projectId}/docs/${type}`, {
      method: "PATCH",
      body: JSON.stringify({ sectionKey: section.key, content: draft }),
    })
    setSaving(false)
    if (!ok) {
      toast.error(body.error || "Não foi possível salvar a seção.")
      return
    }
    toast.success("Seção salva.")
    onSaved(draft)
  }

  return (
    <li className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", isWriting && "border-primary/50")}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant="outline" className="gap-1 text-[10px]">
          <BadgeIcon className="size-3" />
          {badge.label}
        </Badge>
        {section.source === "manual" && <Badge variant="secondary" className="text-[10px]">Editada à mão</Badge>}
        {canEdit && section.kind === "ia" && !isEditing && (
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2" disabled={busy} onClick={() => setAskInstructions((v) => !v)}>
              {isWriting ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
              {hasContent ? "Reescrever" : "Escrever"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2"
              disabled={busy}
              onClick={() => {
                setDraft(section.content)
                onEdit()
              }}
            >
              <PencilIcon className="size-3.5" />
              Editar
            </Button>
          </div>
        )}
      </div>

      {askInstructions && !busy && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center">
          <Input
            value={instructions}
            maxLength={500}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instruções para a IA (opcional): ex. detalhe os sensores, use tabela"
            aria-label={`Instruções para escrever ${section.title}`}
            className="flex-1"
          />
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setAskInstructions(false)
              onWrite(instructions.trim() || undefined)
            }}
          >
            <SparklesIcon />
            {hasContent ? "Reescrever" : "Escrever"}
          </Button>
        </div>
      )}

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            className="font-mono text-xs"
            aria-label={`Texto de ${section.title} em Markdown`}
          />
          <p className="text-[11px] text-muted-foreground">Markdown: **negrito**, listas com -, tabelas com | coluna | coluna |.</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={() => void save()} className="gap-1.5">
              {saving && <LoaderCircleIcon className="animate-spin" />}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" disabled={saving} onClick={onCancelEdit}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : hasContent ? (
        <DocMarkdown content={section.content} />
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {section.kind === "diagrama"
            ? "Este diagrama ainda não foi gerado. Gere na aba Diagramas e ele aparece aqui."
            : `Ainda não escrita. Deve conter: ${section.guide}`}
        </p>
      )}
    </li>
  )
}

function PublishDialog({
  open,
  version,
  onOpenChange,
  onPublish,
}: Readonly<{
  open: boolean
  version: string
  onOpenChange: (open: boolean) => void
  onPublish: (note: string) => Promise<boolean>
}>) {
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!note.trim()) return
            setSaving(true)
            const ok = await onPublish(note.trim())
            setSaving(false)
            if (ok) {
              setNote("")
              onOpenChange(false)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Publicar nova versão</DialogTitle>
            <DialogDescription>
              Fecha a versão atual ({version}) no histórico de revisões do documento, com a data, o autor e o que mudou.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="O que mudou nesta versão?" rows={3} />
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!note.trim() || saving} className="gap-1.5">
              {saving && <LoaderCircleIcon className="animate-spin" />}
              Publicar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------------------------------------------------------- diretrizes */

function SettingsDialog({
  projectId,
  open,
  settings,
  onOpenChange,
  onSaved,
}: Readonly<{
  projectId: string
  open: boolean
  settings: DocSettings
  onOpenChange: (open: boolean) => void
  onSaved: (settings: DocSettings) => void
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {open && <SettingsForm projectId={projectId} settings={settings} onClose={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function SettingsForm({
  projectId,
  settings,
  onClose,
  onSaved,
}: Readonly<{ projectId: string; settings: DocSettings; onClose: () => void; onSaved: (settings: DocSettings) => void }>) {
  const [academic, setAcademic] = useState(settings.academic)
  const [institution, setInstitution] = useState(settings.institution ?? "")
  const [course, setCourse] = useState(settings.course ?? "")
  const [authors, setAuthors] = useState(settings.authors ?? "")
  const [advisor, setAdvisor] = useState(settings.advisor ?? "")
  const [notes, setNotes] = useState(settings.notes ?? "")
  const [reference, setReference] = useState({ name: settings.referenceName, chars: settings.referenceChars })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = ""
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append("file", file)
    const { ok, body } = await request<{ settings: DocSettings }>(`/api/projects/${projectId}/docs/reference`, { method: "POST", body: form })
    setUploading(false)
    if (!ok) {
      toast.error(body.error || "Não foi possível ler o arquivo.")
      return
    }
    setReference({ name: body.settings.referenceName, chars: body.settings.referenceChars })
    onSaved(body.settings)
    toast.success("Modelo de referência anexado.")
  }

  async function removeReference() {
    const { ok, body } = await request<{ settings: DocSettings }>(`/api/projects/${projectId}/docs/reference`, { method: "DELETE" })
    if (!ok) {
      toast.error(body.error || "Não foi possível remover o modelo.")
      return
    }
    setReference({ name: null, chars: 0 })
    onSaved(body.settings)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { ok, body } = await request<{ settings: DocSettings }>(`/api/projects/${projectId}/docs/settings`, {
      method: "PUT",
      body: JSON.stringify({ academic, institution, course, authors, advisor, notes }),
    })
    setSaving(false)
    if (!ok) {
      toast.error(body.error || "Não foi possível salvar as diretrizes.")
      return
    }
    onSaved(body.settings)
    toast.success("Diretrizes salvas.")
    onClose()
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Diretrizes da documentação</DialogTitle>
        <DialogDescription>Valem para todos os documentos deste projeto e orientam a IA ao escrever.</DialogDescription>
      </DialogHeader>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
        <Checkbox checked={academic} onCheckedChange={(v) => setAcademic(v === true)} className="mt-0.5" />
        <span>
          É uma entrega acadêmica (trabalho de faculdade, TCC)
          <span className="block text-xs text-muted-foreground">A IA escreve em linguagem formal e impessoal, e a capa do PDF traz a instituição e o curso.</span>
        </span>
      </label>

      {academic && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-institution">Instituição</Label>
            <Input id="doc-institution" value={institution} maxLength={120} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex.: PUCPR" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-course">Curso</Label>
            <Input id="doc-course" value={course} maxLength={120} onChange={(e) => setCourse(e.target.value)} placeholder="Ex.: Engenharia de Software" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-advisor">Orientador</Label>
            <Input id="doc-advisor" value={advisor} maxLength={120} onChange={(e) => setAdvisor(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-authors">Autores</Label>
        <Input id="doc-authors" value={authors} maxLength={300} onChange={(e) => setAuthors(e.target.value)} placeholder="Nomes separados por vírgula" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Modelo de referência (opcional)</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          O modelo da instituição, a rubrica da avaliação ou um documento de exemplo. PDF, Word (.docx), Markdown ou texto, até
          10 MB. A IA segue a estrutura e as exigências dele.
        </p>
        {reference.name ? (
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{reference.name}</span>
            <span className="text-xs text-muted-foreground">{reference.chars.toLocaleString("pt-BR")} caracteres</span>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Remover o modelo" onClick={() => void removeReference()}>
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="gap-1.5 self-start" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <LoaderCircleIcon className="animate-spin" /> : <PaperclipIcon />}
            Anexar modelo
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.md,.markdown,.txt"
          className="hidden"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-notes">Observações para a IA (opcional)</Label>
        <Textarea
          id="doc-notes"
          value={notes}
          maxLength={1500}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: o público é a banca avaliadora; cite as normas; evite siglas sem explicação."
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving} className="gap-1.5">
          {saving && <LoaderCircleIcon className="animate-spin" />}
          Salvar diretrizes
        </Button>
      </DialogFooter>
    </form>
  )
}
