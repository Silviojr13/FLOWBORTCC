"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { toast } from "sonner"
import {
  BotIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AI_PROVIDERS,
  AI_PROVIDER_INFO,
  aiKeyDisplayName,
  type AiKeySummary,
  type AiProvider,
} from "@/lib/ai-providers"
import { cn } from "@/lib/utils"
import { ClaudeBridge } from "./claude-bridge"

interface KeysData {
  keys: AiKeySummary[]
  encryptionReady: boolean
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || "Não foi possível concluir a ação.")
  return body as T
}

/**
 * Minhas IAs: a pessoa conecta as IAs que já paga (com a chave de API) e escolhe qual delas
 * responde no assistente do FlowBot no lugar da IA gratuita.
 */
export function MyAiKeys() {
  const [data, setData] = useState<KeysData | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [editing, setEditing] = useState<AiKeySummary | null>(null)

  // Incrementado depois de cada alteração: recarrega a lista.
  const [reloadToken, setReloadToken] = useState(0)
  const load = useCallback(() => setReloadToken((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    request<KeysData>("/api/ai-keys")
      .then((body) => !cancelled && setData(body))
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível carregar as suas IAs.")
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  async function run(key: string, action: () => Promise<unknown>, success?: string) {
    setBusy(key)
    try {
      await action()
      if (success) toast.success(success)
      load()
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.")
      return false
    } finally {
      setBusy(null)
    }
  }

  if (!data) return <p className="text-sm text-muted-foreground">Carregando...</p>

  const active = data.keys.find((k) => k.useInAssistant) ?? null

  function chooseAssistant(key: AiKeySummary | null) {
    if (busy) return
    if ((key?.id ?? null) === (active?.id ?? null)) return
    if (key) {
      void run(
        `assistant-${key.id}`,
        () => request(`/api/ai-keys/${key.id}`, { method: "PATCH", body: JSON.stringify({ useInAssistant: true }) }),
        `O assistente agora responde com ${aiKeyDisplayName(key)}.`
      )
    } else if (active) {
      void run(
        "assistant-free",
        () => request(`/api/ai-keys/${active.id}`, { method: "PATCH", body: JSON.stringify({ useInAssistant: false }) }),
        "O assistente voltou para a IA gratuita do FlowBot."
      )
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {!data.encryptionReady && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          O servidor ainda não tem o segredo para guardar chaves com segurança (AI_KEYS_SECRET ou AUTH_SECRET).
          Fale com quem administra o FlowBot.
        </p>
      )}

      <section className="flex flex-col gap-3" data-tour="aikeys-assistant">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-foreground">Quem responde no assistente</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Vale para o chat de criação de projetos e para o assistente dentro de cada projeto. Com a sua chave,
            o assistente lê mais do projeto, responde mais longo e monta pacotes maiores de uma vez.
          </p>
        </div>
        <div role="radiogroup" aria-label="IA do assistente" className="grid gap-2 sm:grid-cols-2">
          <AssistantOption
            checked={!active}
            disabled={busy !== null}
            loading={busy === "assistant-free"}
            title="IA gratuita do FlowBot"
            detail="Groq, com limite de uso por minuto"
            onSelect={() => chooseAssistant(null)}
          />
          {data.keys.map((key) => (
            <AssistantOption
              key={key.id}
              checked={key.useInAssistant}
              disabled={busy !== null}
              loading={busy === `assistant-${key.id}`}
              title={aiKeyDisplayName(key)}
              detail={key.model}
              onSelect={() => chooseAssistant(key)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-foreground">IAs conectadas</h2>
            <p className="text-xs text-muted-foreground">
              OpenAI (ChatGPT), Anthropic (Claude), Google Gemini, Groq ou OpenRouter, com a sua chave de API.
            </p>
          </div>
          <Button
            className="gap-1.5"
            disabled={!data.encryptionReady}
            onClick={() => setConnectOpen(true)}
            data-tour="aikeys-connect"
          >
            <PlusIcon />
            Conectar IA
          </Button>
        </div>

        {data.keys.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <BotIcon className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-foreground">Nenhuma IA conectada ainda.</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Conecte a IA que você já usa para ela trabalhar junto com o FlowBot. Enquanto isso, o assistente usa a
              IA gratuita.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {data.keys.map((key) => (
              <li key={key.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BotIcon className="size-4" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {aiKeyDisplayName(key)}
                      {key.useInAssistant && <Badge variant="secondary">No assistente</Badge>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {key.label ? `${AI_PROVIDER_INFO[key.provider].label} · ` : ""}
                      {key.model}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <KeyRoundIcon className="size-3" aria-hidden />
                      <span className="font-mono">{key.keyHint}</span>
                      {key.lastTestedAt && <span>· funcionou em {dateTime.format(new Date(key.lastTestedAt))}</span>}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `test-${key.id}`,
                        () => request(`/api/ai-keys/${key.id}/test`, { method: "POST" }),
                        `${aiKeyDisplayName(key)} respondeu. Está tudo certo.`
                      )
                    }
                  >
                    {busy === `test-${key.id}` ? (
                      <LoaderCircleIcon className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2Icon className="size-3.5" />
                    )}
                    Testar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2"
                    disabled={busy !== null}
                    onClick={() => setEditing(key)}
                  >
                    <RefreshCwIcon className="size-3.5" />
                    Trocar modelo
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2 text-muted-foreground hover:text-destructive"
                    disabled={busy !== null}
                    onClick={() => {
                      if (!window.confirm(`Desconectar ${aiKeyDisplayName(key)}? A chave guardada é apagada.`)) return
                      void run(
                        `remove-${key.id}`,
                        () => request(`/api/ai-keys/${key.id}`, { method: "DELETE" }),
                        key.useInAssistant
                          ? "IA desconectada. O assistente voltou para a IA gratuita do FlowBot."
                          : "IA desconectada."
                      )
                    }}
                  >
                    <Trash2Icon className="size-3.5" />
                    Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ClaudeBridge />

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheckIcon className="size-4 text-primary" aria-hidden />
            Como a sua chave é guardada
          </span>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>Fica criptografada no banco e nunca volta para a tela: você só vê o final dela.</li>
            <li>Só responde às suas mensagens, mesmo em projetos compartilhados.</li>
            <li>Remover a IA apaga a chave. Você também pode revogá-la no site do provedor.</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <SparklesIcon className="size-4 text-primary" aria-hidden />
            Conselho de IAs
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dentro de cada projeto, na aba <strong className="font-medium text-foreground">Conselho de IAs</strong>,
            as IAs conectadas aqui ganham cargos (gerente, analista de sprints, revisor de requisitos...), discutem o
            projeto em reunião e propõem os próximos passos numa ata.
          </p>
        </div>
      </section>

      <ConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        firstKey={data.keys.length === 0}
        onConnected={async (key) => {
          setConnectOpen(false)
          toast.success(
            key.useInAssistant
              ? `${aiKeyDisplayName(key)} conectada. O assistente já responde com ela.`
              : `${aiKeyDisplayName(key)} conectada.`
          )
          load()
        }}
      />

      <EditModelDialog
        aiKey={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={async () => {
          setEditing(null)
          toast.success("Modelo trocado. A IA respondeu ao teste.")
          load()
        }}
      />
    </div>
  )
}

function AssistantOption({
  checked,
  disabled,
  loading,
  title,
  detail,
  onSelect,
}: {
  checked: boolean
  disabled: boolean
  loading: boolean
  title: string
  detail: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        checked ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50",
        disabled && !checked && "opacity-70"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-primary" : "border-muted-foreground/50"
        )}
      >
        {checked && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      {loading && <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" aria-hidden />}
    </button>
  )
}

function ConnectDialog({
  open,
  onOpenChange,
  firstKey,
  onConnected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  firstKey: boolean
  onConnected: (key: AiKeySummary) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        {/* O formulário só existe com o diálogo aberto: abre sempre limpo, sem a chave anterior. */}
        {open && (
          <ConnectForm
            firstKey={firstKey}
            saving={saving}
            setSaving={setSaving}
            onCancel={() => onOpenChange(false)}
            onConnected={onConnected}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ConnectForm({
  firstKey,
  saving,
  setSaving,
  onCancel,
  onConnected,
}: {
  firstKey: boolean
  saving: boolean
  setSaving: (saving: boolean) => void
  onCancel: () => void
  onConnected: (key: AiKeySummary) => Promise<void>
}) {
  const [provider, setProvider] = useState<AiProvider>("openai")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("")
  const [label, setLabel] = useState("")
  const [useInAssistant, setUseInAssistant] = useState(firstKey)
  const [models, setModels] = useState<string[] | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const info = AI_PROVIDER_INFO[provider]
  const trimmedKey = apiKey.trim()

  async function fetchModels() {
    if (!trimmedKey || loadingModels) return
    setLoadingModels(true)
    try {
      const body = await request<{ models: string[] }>("/api/ai-keys/models", {
        method: "POST",
        body: JSON.stringify({ provider, apiKey: trimmedKey }),
      })
      setModels(body.models)
      if (!model && body.models.length > 0) {
        setModel(info.suggestedModels.find((m) => body.models.includes(m)) ?? body.models[0])
      }
      if (body.models.length === 0) toast.info("O provedor não listou modelos. Digite o nome do modelo.")
    } catch (error) {
      setModels(null)
      toast.error(error instanceof Error ? error.message : "Não foi possível buscar os modelos.")
    } finally {
      setLoadingModels(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmedKey || !model.trim() || saving) return
    setSaving(true)
    try {
      const body = await request<{ key: AiKeySummary }>("/api/ai-keys", {
        method: "POST",
        body: JSON.stringify({ provider, apiKey: trimmedKey, model: model.trim(), label, useInAssistant }),
      })
      setApiKey("")
      await onConnected(body.key)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível conectar a IA.")
    } finally {
      setSaving(false)
    }
  }

  const prefixWarning = info.keyPrefix && trimmedKey.length > 6 && !trimmedKey.startsWith(info.keyPrefix)

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Conectar IA</DialogTitle>
        <DialogDescription>
          O FlowBot testa a chave com o modelo escolhido antes de salvar.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-provider">Provedor</Label>
        <Select
          value={provider}
          onValueChange={(value) => {
            setProvider(value as AiProvider)
            setModel("")
            setModels(null)
          }}
        >
          <SelectTrigger id="ai-provider" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>
                {AI_PROVIDER_INFO[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs leading-relaxed text-muted-foreground">{info.note}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="ai-key">Chave de API</Label>
          <a
            href={info.keysUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Criar uma chave
            <ExternalLinkIcon className="size-3" aria-hidden />
          </a>
        </div>
        <div className="flex gap-2">
          <Input
            id="ai-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setModels(null)
            }}
            placeholder={info.keyPrefix ? `${info.keyPrefix}...` : "Cole a chave aqui"}
            className="flex-1 font-mono"
          />
          <Button
            type="button"
            variant="outline"
            disabled={!trimmedKey || loadingModels}
            onClick={() => void fetchModels()}
            className="gap-1.5"
          >
            {loadingModels ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
            Buscar modelos
          </Button>
        </div>
        {prefixWarning && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Chaves {info.of} costumam começar com “{info.keyPrefix}”. Confira se colou a chave certa.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-model">Modelo</Label>
        <ModelCombobox
          id="ai-model"
          value={model}
          onChange={setModel}
          options={models ?? info.suggestedModels}
        />
        <p className="text-xs text-muted-foreground">
          {models
            ? `${models.length} modelos disponíveis para esta chave. Digite para filtrar.`
            : "Clique em “Buscar modelos” para ver os modelos da sua chave, ou digite o nome."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-label">Apelido (opcional)</Label>
        <Input
          id="ai-label"
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex.: ChatGPT do trabalho"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox checked={useInAssistant} onCheckedChange={(checked) => setUseInAssistant(checked === true)} />
        Usar esta IA no assistente do FlowBot
      </label>

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!trimmedKey || !model.trim() || saving} className="gap-1.5">
          {saving && <LoaderCircleIcon className="animate-spin" />}
          {saving ? "Testando..." : "Testar e conectar"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function EditModelDialog({
  aiKey,
  onOpenChange,
  onSaved,
}: {
  aiKey: AiKeySummary | null
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  return (
    <Dialog open={aiKey !== null} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        {aiKey && (
          <EditModelForm
            key={aiKey.id}
            aiKey={aiKey}
            saving={saving}
            setSaving={setSaving}
            onCancel={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditModelForm({
  aiKey,
  saving,
  setSaving,
  onCancel,
  onSaved,
}: {
  aiKey: AiKeySummary
  saving: boolean
  setSaving: (saving: boolean) => void
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [model, setModel] = useState(aiKey.model)
  const [label, setLabel] = useState(aiKey.label ?? "")
  const [models, setModels] = useState<string[] | null>(null)
  const [loadingModels, setLoadingModels] = useState(true)

  // Busca os modelos da chave ao abrir.
  useEffect(() => {
    let cancelled = false
    request<{ models: string[] }>("/api/ai-keys/models", { method: "POST", body: JSON.stringify({ keyId: aiKey.id }) })
      .then((body) => !cancelled && setModels(body.models))
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível buscar os modelos.")
      })
      .finally(() => !cancelled && setLoadingModels(false))
    return () => {
      cancelled = true
    }
  }, [aiKey.id])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!model.trim() || saving) return
    setSaving(true)
    try {
      await request(`/api/ai-keys/${aiKey.id}`, {
        method: "PATCH",
        body: JSON.stringify({ model: model.trim(), label }),
      })
      await onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível trocar o modelo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Trocar modelo</DialogTitle>
        <DialogDescription>
          {AI_PROVIDER_INFO[aiKey.provider].label} · chave <span className="font-mono">{aiKey.keyHint}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-edit-model">Modelo</Label>
        <ModelCombobox
          id="ai-edit-model"
          value={model}
          onChange={setModel}
          options={models ?? AI_PROVIDER_INFO[aiKey.provider].suggestedModels}
        />
        <p className="text-xs text-muted-foreground">
          {loadingModels
            ? "Buscando os modelos da sua chave..."
            : models
              ? `${models.length} modelos disponíveis. Digite para filtrar.`
              : "Digite o nome do modelo."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-edit-label">Apelido (opcional)</Label>
        <Input id="ai-edit-label" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!model.trim() || saving} className="gap-1.5">
          {saving && <LoaderCircleIcon className="animate-spin" />}
          {saving ? "Testando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Campo do modelo com a lista da chave logo abaixo (filtra enquanto digita). Aceita também
 * um nome digitado, para modelos que o provedor não lista.
 */
function ModelCombobox({
  id,
  value,
  onChange,
  options,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const typed = value.trim().toLowerCase()
  const filtered = options.filter((m) => m.toLowerCase().includes(typed) && m.toLowerCase() !== typed).slice(0, 60)
  // Com um modelo já escolhido, abrir a lista mostra todas as opções.
  const shown = filtered.length > 0 ? filtered : open && options.includes(value) ? options.slice(0, 60) : []
  const showList = open && shown.length > 0

  function pick(m: string) {
    onChange(m)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder="Ex.: gpt-4o-mini"
        className="font-mono"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && shown.length > 0) {
            e.preventDefault()
            setOpen(true)
            setActive((i) => (i + 1) % shown.length)
          } else if (e.key === "ArrowUp" && shown.length > 0) {
            e.preventDefault()
            setOpen(true)
            setActive((i) => (i <= 0 ? shown.length - 1 : i - 1))
          } else if (e.key === "Enter" && showList && active >= 0) {
            e.preventDefault()
            pick(shown[active])
          } else if (e.key === "Escape" && showList) {
            // Fecha só a lista, sem fechar o diálogo.
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Modelos disponíveis"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {shown.map((m, index) => (
            <li
              key={m}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown antes do blur do campo, para a escolha não se perder.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(m)
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "cursor-pointer truncate rounded-md px-2 py-1.5 font-mono text-xs",
                index === active ? "bg-accent text-accent-foreground" : "text-foreground",
                m === value && "font-semibold"
              )}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
