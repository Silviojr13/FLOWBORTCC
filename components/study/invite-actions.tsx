"use client"

import Link from "next/link"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { savePendingInvite } from "@/lib/use-study-me"

// Guarda o código do convite antes do login ou cadastro: o painel do participante o encontra
// quando a pessoa chegar ao painel, mesmo passando pela pesquisa inicial.
export function InviteActions({ code, loggedIn }: { code: string; loggedIn: boolean }) {
  useEffect(() => {
    savePendingInvite(code)
  }, [code])

  if (loggedIn) {
    return (
      <Button asChild size="lg" onClick={() => savePendingInvite(code)}>
        <Link href="/dashboard">Continuar para o FlowBot</Link>
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button asChild size="lg" className="sm:flex-1" onClick={() => savePendingInvite(code)}>
        <Link href="/register">Criar conta</Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="sm:flex-1" onClick={() => savePendingInvite(code)}>
        <Link href="/login">Já tenho conta</Link>
      </Button>
    </div>
  )
}
