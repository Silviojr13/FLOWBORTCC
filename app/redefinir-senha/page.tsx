"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { CheckCircle2Icon, LinkIcon } from "lucide-react"
import { AuthCard, AuthHeader, AuthLogo, AuthPageShell } from "@/components/auth/auth-layout"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type LinkState =
  | { status: "checking" }
  | { status: "invalid"; message: string }
  | { status: "valid"; email: string; hasPassword: boolean }

// Segundo passo da recuperação: aberta pelo link do e-mail, define a nova senha.
function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? ""
  const [link, setLink] = useState<LinkState>({ status: "checking" })
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setLink(
          data.valid
            ? { status: "valid", email: data.email, hasPassword: data.hasPassword }
            : { status: "invalid", message: data.error }
        )
      })
      .catch(() => !cancelled && setLink({ status: "invalid", message: "Não foi possível conferir o link. Tente novamente." }))
    return () => {
      cancelled = true
    }
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError("As senhas não coincidem.")
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (res.status === 410) {
        setLink({ status: "invalid", message: data.error })
        return
      }
      if (!res.ok) throw new Error(data.error || "Não foi possível alterar a senha.")
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.")
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2Icon className="size-10 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <AuthHeader title="Senha alterada" description="Pronto! Use a nova senha para entrar no FlowBot." />
        <Button asChild size="lg" className="h-10 w-full">
          <Link href="/login">Ir para o login</Link>
        </Button>
      </div>
    )
  }

  if (link.status === "checking") {
    return <p className="py-6 text-center text-sm text-muted-foreground">Conferindo o link...</p>
  }

  if (link.status === "invalid") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <LinkIcon className="size-10 text-muted-foreground" aria-hidden />
        <AuthHeader title="Link indisponível" description={link.message} />
        <Button asChild size="lg" className="h-10 w-full">
          <Link href="/esqueci-senha">Pedir um novo link</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <AuthHeader
        title={link.hasPassword ? "Criar nova senha" : "Definir uma senha"}
        description={`Conta ${link.email}`}
      />
      <form onSubmit={(e) => void submit(e)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="reset-password">Nova senha</FieldLabel>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
              autoFocus
            />
            <FieldDescription>Pelo menos 8 caracteres, com letras e números.</FieldDescription>
          </Field>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="reset-confirm">Confirme a nova senha</FieldLabel>
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "reset-error" : undefined}
              className="h-10"
            />
            {error && <FieldError id="reset-error">{error}</FieldError>}
          </Field>
          <Field>
            <Button type="submit" size="lg" className="h-10 w-full" disabled={busy || !password || !confirm}>
              {busy ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthPageShell>
      <AuthCard>
        <AuthLogo />
        <Suspense fallback={<p className="py-6 text-center text-sm text-muted-foreground">Conferindo o link...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </AuthCard>
    </AuthPageShell>
  )
}
