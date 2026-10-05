"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { clearPendingProjectInvite, readPendingProjectInvite } from "@/lib/pending-project-invite"

/**
 * Quem abriu um convite de projeto antes de entrar volta para ele assim que chega ao painel
 * (depois do login ou do cadastro), em vez de ter de procurá-lo.
 */
export function PendingInviteRedirect() {
  const router = useRouter()

  useEffect(() => {
    const code = readPendingProjectInvite()
    if (!code) return
    clearPendingProjectInvite()
    router.replace(`/convite/${encodeURIComponent(code)}`)
  }, [router])

  return null
}
