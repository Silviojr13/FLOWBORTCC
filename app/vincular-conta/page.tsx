"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { LinkIcon, UserCheckIcon } from "lucide-react"
import { AuthCard, AuthHeader, AuthLogo, AuthPageShell } from "@/components/auth/auth-layout"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type State =
  | { status: "checking" }
  | { status: "invalid"; message: string }
  | { status: "valid"; email: string; hasPassword: boolean }

/**
 * Aberta pelo login com Google quando o e-mail já tem conta criada com e-mail e senha.
 * Explica a situação e, se a pessoa quiser, associa o Google à conta existente depois de
 * confirmar a senha dela.
 */
function LinkAccount() {
  const router = useRouter()
  const token = useSearchParams().get("token") ?? ""
  const [state, setState] = useState<State>({ status: "checking" })
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/auth/link-account?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setState(
          data.valid
            ? { status: "valid", email: data.email, hasPassword: data.hasPassword }
            : { status: "invalid", message: data.error }
        )
      })
      .catch(() => !cancelled && setState({ status: "invalid", message: "Não foi possível continuar. Tente entrar de novo." }))
    return () => {
      cancelled = true
    }
  }, [token])

  async function link(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch("/api/auth/link-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (res.status === 410) {
        setState({ status: "invalid", message: data.error })
        return
      }
      if (!res.ok) throw new Error(data.error || "Não foi possível associar as contas.")

      // Contas associadas: entra direto, com a senha que acabou de ser confirmada.
      const result = await signIn("credentials", { email: data.email, password, redirect: false })
      if (result?.error) {
        router.push("/login")
        return
      }
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível associar as contas.")
      setBusy(false)
    }
  }

  if (state.status === "checking") {
    return <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
  }

  if (state.status === "invalid") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <LinkIcon className="size-10 text-muted-foreground" aria-hidden />
        <AuthHeader title="Pedido expirado" description={state.message} />
        <Button asChild size="lg" className="h-10 w-full">
          <Link href="/login">Voltar para o login</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <UserCheckIcon className="size-10 text-primary" aria-hidden />
        <AuthHeader
          title="Você já tem uma conta"
          description={`O e-mail ${state.email} já tem uma conta no FlowBot, criada com e-mail e senha.`}
        />
      </div>

      <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Quer usar também o Google para entrar nela? Ao associar, as duas formas de login abrem a
        <strong className="font-medium text-foreground"> mesma conta</strong>, com os mesmos projetos.
        Para sua segurança, confirme a senha da conta existente.
      </div>

      {state.hasPassword ? (
        <form onSubmit={(e) => void link(e)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <div className="flex items-center">
                <FieldLabel htmlFor="link-password">Senha da sua conta FlowBot</FieldLabel>
                <Link href="/esqueci-senha" className="ml-auto text-sm text-primary underline-offset-4 hover:underline">
                  Esqueci a senha
                </Link>
              </div>
              <Input
                id="link-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "link-error" : undefined}
                className="h-10"
                autoFocus
              />
              {error && <FieldError id="link-error">{error}</FieldError>}
            </Field>
            <Field>
              <Button type="submit" size="lg" className="h-10 w-full" disabled={busy || !password}>
                {busy ? "Associando..." : "Associar o Google e entrar"}
              </Button>
            </Field>
            <Button asChild variant="ghost" className="w-full text-muted-foreground">
              <Link href="/login">Agora não, entrar só com e-mail e senha</Link>
            </Button>
          </FieldGroup>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Esta conta ainda não tem senha. Crie uma pela recuperação de senha e depois entre com o
            Google de novo para associar.
          </p>
          <Button asChild size="lg" className="h-10 w-full">
            <Link href="/esqueci-senha">Criar uma senha</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

export default function LinkAccountPage() {
  return (
    <AuthPageShell>
      <AuthCard>
        <AuthLogo />
        <Suspense fallback={<p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>}>
          <LinkAccount />
        </Suspense>
      </AuthCard>
    </AuthPageShell>
  )
}
