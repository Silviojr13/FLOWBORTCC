"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CopyIcon, KeyRoundIcon, LoaderCircleIcon, PlusIcon, TerminalIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ApiTokenRow {
  id: string
  name: string
  tokenHint: string
  lastUsedAt: string | null
  createdAt: string
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

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copiado.`)
  } catch {
    toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.")
  }
}

/**
 * Ponte com o Claude Code: a pessoa gera um token pessoal e conecta o Claude Code ao
 * servidor MCP do FlowBot. O token aparece uma única vez, junto com o comando pronto.
 */
export function ClaudeBridge() {
  const [tokens, setTokens] = useState<ApiTokenRow[] | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [name, setName] = useState("Claude Code")
  const [busy, setBusy] = useState<string | null>(null)
  // Token recém-gerado: só existe na tela até a pessoa sair dela.
  const [secret, setSecret] = useState<string | null>(null)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    let cancelled = false
    request<{ tokens: ApiTokenRow[] }>("/api/api-tokens")
      .then((body) => !cancelled && setTokens(body.tokens))
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Não foi possível carregar os tokens.")
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  async function generate(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy("generate")
    try {
      const body = await request<{ secret: string }>("/api/api-tokens", {
        method: "POST",
        body: JSON.stringify({ name }),
      })
      setOrigin(window.location.origin)
      setSecret(body.secret)
      setReloadToken((t) => t + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o token.")
    } finally {
      setBusy(null)
    }
  }

  async function revoke(token: ApiTokenRow) {
    if (!window.confirm(`Revogar o token "${token.name}"? O Claude Code que usa este token perde o acesso na hora.`)) return
    setBusy(`revoke-${token.id}`)
    try {
      await request(`/api/api-tokens/${token.id}`, { method: "DELETE" })
      toast.success("Token revogado.")
      setReloadToken((t) => t + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível revogar o token.")
    } finally {
      setBusy(null)
    }
  }

  const command = secret
    ? `claude mcp add --transport http flowbot ${origin}/api/mcp --header "Authorization: Bearer ${secret}"`
    : ""

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm dark:shadow-none sm:p-5"
      data-tour="aikeys-bridge"
    >
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <TerminalIcon className="size-4 text-primary" aria-hidden />
          Ponte com o Claude Code
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          O Claude Code lê os requisitos, as tarefas e as sprints dos seus projetos, desenvolve o software e devolve o
          andamento para o FlowBot: move as tarefas no quadro e registra o que fez na aba Desenvolvimento. Usa a sua
          assinatura do Claude, sem chave de API.
        </p>
      </div>

      <ol className="flex list-decimal flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
        <li>Gere um token abaixo e copie o comando.</li>
        <li>Rode o comando no terminal, dentro da pasta do código do projeto.</li>
        <li>
          No Claude Code, peça algo como:{" "}
          <em className="text-foreground">“Leia o projeto X no FlowBot e implemente as tarefas da Sprint 1.”</em>
        </li>
      </ol>

      {secret ? (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-medium text-foreground">
            Copie agora: por segurança, este token não aparece de novo.
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Comando para o terminal</span>
            <div className="flex gap-2">
              <Input readOnly value={command} aria-label="Comando para conectar o Claude Code" className="flex-1 font-mono text-xs" />
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => void copy(command, "Comando")}>
                <CopyIcon />
                Copiar
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Só o token</span>
            <div className="flex gap-2">
              <Input readOnly value={secret} aria-label="Token gerado" className="flex-1 font-mono text-xs" />
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => void copy(secret, "Token")}>
                <CopyIcon />
                Copiar
              </Button>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setSecret(null)}>
            Pronto, já copiei
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void generate(e)} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do token (ex.: Claude Code do notebook)"
            aria-label="Nome do token"
            className="sm:flex-1"
          />
          <Button type="submit" disabled={!name.trim() || busy !== null} className="gap-1.5">
            {busy === "generate" ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
            Gerar token
          </Button>
        </form>
      )}

      {tokens && tokens.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {tokens.map((token) => (
            <li key={token.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-foreground">{token.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{token.tokenHint}</span>
              <span className="text-xs text-muted-foreground">
                {token.lastUsedAt ? `usado em ${dateTime.format(new Date(token.lastUsedAt))}` : "nunca usado"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-muted-foreground hover:text-destructive"
                disabled={busy !== null}
                onClick={() => void revoke(token)}
              >
                <Trash2Icon className="size-3.5" />
                Revogar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
