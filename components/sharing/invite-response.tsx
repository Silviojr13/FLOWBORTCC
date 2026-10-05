"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { LoaderCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { clearPendingProjectInvite, savePendingProjectInvite } from "@/lib/pending-project-invite"
import { notifyProjectsChanged } from "@/lib/projects-changed"

/** Aceitar ou recusar um convite de projeto (pessoa logada). */
export function InviteResponse({ code, canDecline }: { code: string; canDecline: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<"aceitar" | "recusar" | null>(null)

  async function respond(action: "aceitar" | "recusar") {
    setBusy(action)
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Não foi possível responder ao convite.")
      clearPendingProjectInvite()
      notifyProjectsChanged()
      if (action === "aceitar") {
        toast.success("Convite aceito. Você entrou como visitante.")
        router.push(`/dashboard/projects/${data.projectId}`)
      } else {
        toast.success("Convite recusado.")
        router.push("/dashboard/projects")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível responder ao convite.")
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button size="lg" className="sm:flex-1" disabled={busy !== null} onClick={() => void respond("aceitar")}>
        {busy === "aceitar" && <LoaderCircleIcon className="animate-spin" />}
        Aceitar convite
      </Button>
      {canDecline && (
        <Button
          size="lg"
          variant="outline"
          className="sm:flex-1"
          disabled={busy !== null}
          onClick={() => void respond("recusar")}
        >
          Recusar
        </Button>
      )}
    </div>
  )
}

/** Antes do login: guarda o convite para a pessoa encontrá-lo depois de entrar. */
export function InviteSignIn({ code }: { code: string }) {
  useEffect(() => {
    savePendingProjectInvite(code)
  }, [code])

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button asChild size="lg" className="sm:flex-1">
        <Link href="/register">Criar conta</Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="sm:flex-1">
        <Link href="/login">Já tenho conta</Link>
      </Button>
    </div>
  )
}
