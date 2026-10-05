"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CopyIcon, LinkIcon, LoaderCircleIcon, MailIcon, RefreshCwIcon, UserMinusIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { notifyProjectsChanged } from "@/lib/projects-changed"
import {
  COSTS_ON_REQUEST,
  MEMBER_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  isMemberRole,
  type ProjectRole,
} from "@/lib/project-permissions"
import { cn } from "@/lib/utils"

interface Person {
  name: string | null
  image: string | null
  email: string | null
  isYou: boolean
}

interface Member extends Person {
  id: string
  role: string
  canSeeCosts?: boolean
  joinedAt: string
}

interface SharingData {
  owner: Person
  members: Member[]
  canManagePeople: boolean
  invitations?: { id: string; email: string; createdAt: string; expiresAt: string }[]
  link?: { id: string; url: string; expiresAt: string } | null
}

const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

function initials(name: string | null, email: string | null) {
  const base = name?.trim() || email || "?"
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function roleOf(member: Member): ProjectRole {
  return isMemberRole(member.role) ? member.role : "visitante"
}

/**
 * Aba Compartilhamento: quem participa do projeto e com qual cargo. Quem gerencia convida
 * por e-mail ou link, cancela convites, remove pessoas e decide se o visitante vê custos.
 */
export function SharingPanel({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [data, setData] = useState<SharingData | null>(null)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  // Incrementado depois de cada alteração: recarrega a lista.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/projects/${projectId}/sharing`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || "Não foi possível carregar as pessoas do projeto.")
        if (!cancelled) setData(body)
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Não foi possível carregar as pessoas do projeto.")
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId, reloadToken])

  async function call(key: string, url: string, init: RequestInit, success?: string) {
    setBusy(key)
    try {
      const res = await fetch(url, {
        ...init,
        headers: init.body ? { "Content-Type": "application/json" } : undefined,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Não foi possível concluir a ação.")
      if (success) toast.success(success)
      setReloadToken((t) => t + 1)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.")
      return false
    } finally {
      setBusy(null)
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    const typed = email.trim()
    if (!typed) return
    const ok = await call(
      "invite",
      `/api/projects/${projectId}/sharing/invitations`,
      { method: "POST", body: JSON.stringify({ email: typed }) },
      `Convite enviado para ${typed}.`
    )
    if (ok) setEmail("")
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copiado.")
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.")
    }
  }

  async function leave(member: Member) {
    if (!window.confirm("Sair deste projeto? Você deixa de ter acesso a ele.")) return
    const ok = await call("leave", `/api/projects/${projectId}/sharing/members/${member.id}`, { method: "DELETE" })
    if (ok) {
      notifyProjectsChanged()
      toast.success("Você saiu do projeto.")
      router.push("/dashboard/projects")
    }
  }

  if (!data) return <p className="text-sm text-muted-foreground">Carregando...</p>

  const manage = data.canManagePeople

  return (
    <div className="flex flex-col gap-8">
      {manage && (
        <section
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm dark:shadow-none sm:p-5"
          data-tour="sharing-invite"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-foreground">Convidar pessoas</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Quem aceita entra como <strong className="font-medium text-foreground">visitante</strong>: acompanha
              o projeto sem editar nada. Custos e recursos ficam ocultos, a menos que você libere.
            </p>
          </div>

          <form onSubmit={(e) => void invite(e)} className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail da pessoa"
              aria-label="E-mail da pessoa a convidar"
              autoComplete="off"
              className="sm:flex-1"
            />
            <Button type="submit" disabled={!email.trim() || busy === "invite"} className="gap-1.5">
              {busy === "invite" ? <LoaderCircleIcon className="animate-spin" /> : <MailIcon />}
              Convidar
            </Button>
          </form>
          <p className="-mt-2 text-xs text-muted-foreground">
            Por privacidade, o FlowBot não lista quem tem conta: digite o e-mail exato. Se a pessoa ainda
            não tiver conta, ela cria uma e encontra o convite ao entrar.
          </p>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <LinkIcon className="size-4 text-muted-foreground" aria-hidden />
              Link de convite
            </h3>
            {data.link ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input readOnly value={data.link.url} aria-label="Link de convite" className="font-mono text-xs sm:flex-1" />
                  <Button type="button" variant="outline" className="gap-1.5" onClick={() => void copyLink(data.link!.url)}>
                    <CopyIcon />
                    Copiar
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Vale até {date.format(new Date(data.link.expiresAt))} para qualquer pessoa com o link.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2"
                    disabled={busy !== null}
                    onClick={() =>
                      void call("link", `/api/projects/${projectId}/sharing/link`, { method: "POST" }, "Novo link criado. O anterior deixou de valer.")
                    }
                  >
                    <RefreshCwIcon className="size-3.5" />
                    Gerar outro
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    disabled={busy !== null}
                    onClick={() =>
                      void call(
                        "link",
                        `/api/projects/${projectId}/sharing/invitations/${data.link!.id}`,
                        { method: "DELETE" },
                        "Link desativado."
                      )
                    }
                  >
                    Desativar
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-start gap-2">
                <p className="text-xs text-muted-foreground">
                  Útil para grupos: quem abrir o link e entrar no FlowBot vira visitante. Ele vale por 7 dias e
                  pode ser desativado a qualquer momento.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={busy !== null}
                  onClick={() =>
                    void call("link", `/api/projects/${projectId}/sharing/link`, { method: "POST" }, "Link de convite criado.")
                  }
                >
                  {busy === "link" ? <LoaderCircleIcon className="animate-spin" /> : <LinkIcon />}
                  Criar link de convite
                </Button>
              </div>
            )}
          </div>

          {data.invitations && data.invitations.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-sm font-medium text-foreground">Convites aguardando resposta</h3>
              <ul className="flex flex-col divide-y divide-border">
                {data.invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 py-2 text-sm">
                    <MailIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      até {date.format(new Date(inv.expiresAt))}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      disabled={busy !== null}
                      onClick={() =>
                        void call(
                          `inv-${inv.id}`,
                          `/api/projects/${projectId}/sharing/invitations/${inv.id}`,
                          { method: "DELETE" },
                          "Convite cancelado."
                        )
                      }
                    >
                      Cancelar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3" data-tour="sharing-people">
        <h2 className="text-sm font-medium text-foreground">Pessoas no projeto</h2>
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <PersonRow person={data.owner} role="dono" />
          {data.members.map((member) => (
            <PersonRow
              key={member.id}
              person={member}
              role={roleOf(member)}
              roleControl={
                // Quem gerencia muda o cargo dos outros; o próprio cargo não muda por aqui.
                manage && !member.isYou ? (
                  <Select
                    value={roleOf(member)}
                    disabled={busy !== null}
                    onValueChange={(role) =>
                      void call(
                        `role-${member.id}`,
                        `/api/projects/${projectId}/sharing/members/${member.id}`,
                        { method: "PATCH", body: JSON.stringify({ role }) },
                        `${member.name ?? "A pessoa"} agora é ${ROLE_LABELS[role as ProjectRole].toLowerCase()}.`
                      )
                    }
                  >
                    <SelectTrigger size="sm" className="w-36" aria-label={`Cargo de ${member.name ?? member.email ?? "membro"}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : undefined
              }
            >
              {manage && COSTS_ON_REQUEST.includes(roleOf(member)) && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={member.canSeeCosts ?? false}
                    disabled={busy !== null}
                    onCheckedChange={(checked) =>
                      void call(
                        `costs-${member.id}`,
                        `/api/projects/${projectId}/sharing/members/${member.id}`,
                        { method: "PATCH", body: JSON.stringify({ canSeeCosts: checked === true }) },
                        checked === true ? "Agora essa pessoa vê custos e recursos." : "Custos e recursos ocultos para essa pessoa."
                      )
                    }
                  />
                  Vê custos e recursos
                </label>
              )}
              {manage && !member.isYou && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-muted-foreground hover:text-destructive"
                  disabled={busy !== null}
                  onClick={() => {
                    if (!window.confirm(`Remover ${member.name ?? member.email ?? "esta pessoa"} do projeto?`)) return
                    void call(
                      `remove-${member.id}`,
                      `/api/projects/${projectId}/sharing/members/${member.id}`,
                      { method: "DELETE" },
                      "Pessoa removida do projeto."
                    )
                  }}
                >
                  <UserMinusIcon className="size-3.5" />
                  Remover
                </Button>
              )}
              {member.isYou && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  disabled={busy !== null}
                  onClick={() => void leave(member)}
                >
                  Sair do projeto
                </Button>
              )}
            </PersonRow>
          ))}
        </ul>
        {data.members.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ninguém mais participa deste projeto ainda.{manage ? " Convide alguém acima." : ""}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" data-tour="sharing-roles">
        <h2 className="text-sm font-medium text-foreground">O que cada cargo pode fazer</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(["dono", ...MEMBER_ROLES] as ProjectRole[]).map((role) => (
            <li
              key={role}
              className={cn(
                "flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3",
                role === "visitante" && "border-primary/30 bg-primary/5"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {ROLE_LABELS[role]}
                {role === "visitante" && <Badge variant="secondary">Cargo de entrada</Badge>}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function PersonRow({
  person,
  role,
  roleControl,
  children,
}: {
  person: Person
  role: ProjectRole
  /** Seletor de cargo no lugar do selo, para quem pode mudar o cargo. */
  roleControl?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initials(person.name, person.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {person.name ?? person.email ?? "Sem nome"}
            {person.isYou && <span className="font-normal text-muted-foreground"> (você)</span>}
          </p>
          {person.email && <p className="truncate text-xs text-muted-foreground">{person.email}</p>}
        </div>
        <div className="ml-auto shrink-0 sm:ml-2">
          {roleControl ?? (
            <Badge variant={role === "dono" ? "default" : "secondary"}>{ROLE_LABELS[role]}</Badge>
          )}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>}
    </li>
  )
}
