"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeftIcon, MailCheckIcon } from "lucide-react"
import { AuthCard, AuthHeader, AuthLogo, AuthPageShell } from "@/components/auth/auth-layout"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Primeiro passo da recuperação: a pessoa informa o e-mail e recebe o link.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL.test(email.trim())) {
      setError("Informe um e-mail válido.")
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar o link.")
      setSent(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o link. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPageShell>
      <AuthCard>
        <AuthLogo />
        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <MailCheckIcon className="size-10 text-primary" aria-hidden />
            <AuthHeader title="Confira seu e-mail" description={sent} />
            <p className="text-sm text-muted-foreground">
              Não chegou? Olhe a caixa de spam ou promoções e confira se digitou o e-mail certo.
            </p>
            <div className="flex w-full flex-col gap-2">
              <Button variant="outline" onClick={() => setSent(null)}>
                Enviar para outro e-mail
              </Button>
              <Button asChild variant="ghost">
                <Link href="/login">Voltar para o login</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <AuthHeader
              title="Esqueceu sua senha?"
              description="Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha. Vale também para contas criadas com o Google."
            />
            <form onSubmit={(e) => void submit(e)} noValidate>
              <FieldGroup>
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor="forgot-email">E-mail</FieldLabel>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!error}
                    aria-describedby={error ? "forgot-email-error" : undefined}
                    className="h-10"
                    autoFocus
                  />
                  {error && <FieldError id="forgot-email-error">{error}</FieldError>}
                </Field>
                <Field>
                  <Button type="submit" size="lg" className="h-10 w-full" disabled={busy}>
                    {busy ? "Enviando..." : "Enviar link de recuperação"}
                  </Button>
                </Field>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeftIcon className="size-4" aria-hidden />
                  Voltar para o login
                </Link>
              </FieldGroup>
            </form>
          </>
        )}
      </AuthCard>
    </AuthPageShell>
  )
}
