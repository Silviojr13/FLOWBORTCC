"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { MailOpenIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { clearPendingProjectInvite, readPendingProjectInvite } from "@/lib/pending-project-invite"

interface PendingInvite {
  code: string
  projectName: string
  ownerName: string | null
}

/**
 * Convites esperando resposta: os enviados para o e-mail da conta e o link aberto antes do
 * login (guardado no navegador). Cada um leva à página do convite, onde a pessoa aceita.
 */
export function PendingInvitations() {
  const [invites, setInvites] = useState<PendingInvite[]>([])

  useEffect(() => {
    let cancelled = false
    const saved = readPendingProjectInvite()

    Promise.all([
      fetch("/api/invitations").then((res) => (res.ok ? res.json() : { invitations: [] })),
      saved
        ? fetch(`/api/invitations/${encodeURIComponent(saved)}`).then((res) => (res.ok ? res.json() : null))
        : Promise.resolve(null),
    ])
      .then(([mine, fromLink]) => {
        if (cancelled) return
        const list: PendingInvite[] = mine.invitations ?? []
        const link = fromLink?.invitation
        if (saved && link?.status !== "aberto") clearPendingProjectInvite()
        if (link?.status === "aberto" && !list.some((i) => i.code === link.code)) list.unshift(link)
        setInvites(list)
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [])

  if (invites.length === 0) return null

  return (
    <section aria-label="Convites para projetos" className="flex flex-col gap-2">
      {invites.map((invite) => (
        <div
          key={invite.code}
          className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center"
        >
          <MailOpenIcon className="hidden size-5 shrink-0 text-primary sm:block" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-foreground">
            <span className="font-medium">{invite.ownerName?.trim() || "Uma pessoa"}</span> convidou você para o
            projeto <span className="font-medium">{invite.projectName}</span>.
          </p>
          <Button asChild size="sm">
            <Link href={`/convite/${invite.code}`}>Ver convite</Link>
          </Button>
        </div>
      ))}
    </section>
  )
}
