"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { signIn } from "next-auth/react"

import {
  AuthDivider,
  AuthHeader,
  AuthLogo,
  AuthPageShell,
  AuthSwitchLink,
  AuthUnavailableNotice,
  GoogleSignInButton,
} from "@/components/auth/auth-layout"
import { AuthPresentation } from "@/components/auth/auth-presentation"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  fieldErrorsFromZod,
  loginSchema,
  type LoginFormValues,
} from "@/lib/auth-schemas"
import { cn } from "@/lib/utils"

const INVALID_CREDENTIALS_MESSAGE =
  "E-mail ou senha incorretos. Se você criou a conta com o Google, use “Continuar com Google” ou defina uma senha em “Esqueceu sua senha?”."

// Erros que o login com Google devolve na URL (?error=).
const LOGIN_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "Este e-mail já tem uma conta criada com e-mail e senha. Entre com a senha ou tente o Google de novo para associar as contas.",
  GoogleEmailNaoVerificado:
    "O Google não confirmou este e-mail, então não é possível associá-lo a uma conta existente. Entre com e-mail e senha.",
  AccessDenied: "Não foi possível entrar com o Google. Tente de novo.",
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const urlError = useSearchParams().get("error")
  const [values, setValues] = useState<LoginFormValues>({
    email: "",
    password: "",
  })
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof LoginFormValues, string>>
  >({})
  const [formNotice, setFormNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (field: keyof LoginFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setFormNotice(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormNotice(null)

    const result = loginSchema.safeParse(values)
    if (!result.success) {
      setFieldErrors(fieldErrorsFromZod(result.error))
      return
    }

    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const signInResult = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      })

      if (signInResult?.error) {
        setFormNotice(INVALID_CREDENTIALS_MESSAGE)
        setIsSubmitting(false)
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error("Erro de login:", error)
      setFormNotice(
        "Ocorreu um erro durante o login. Por favor, tente novamente."
      )
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageShell
      className={cn(className)}
      presentation={<AuthPresentation />}
      {...props}
    >
      <AuthLogo align="start" />
      <AuthHeader align="start" title="Bem-vindo de volta" />

      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          {formNotice ? (
            <AuthUnavailableNotice message={formNotice} />
          ) : urlError ? (
            <AuthUnavailableNotice message={LOGIN_ERRORS[urlError] ?? "Não foi possível entrar. Tente de novo."} />
          ) : null}

          <Field data-invalid={!!fieldErrors.email}>
            <FieldLabel htmlFor="login-email" className="text-foreground">
              E-mail
            </FieldLabel>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={values.email}
              onChange={(event) => updateField("email", event.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={
                fieldErrors.email ? "login-email-error" : undefined
              }
              className="h-10"
            />
            {fieldErrors.email ? (
              <FieldError id="login-email-error">{fieldErrors.email}</FieldError>
            ) : null}
          </Field>

          <Field data-invalid={!!fieldErrors.password}>
            <div className="flex items-center">
              <FieldLabel htmlFor="login-password" className="text-foreground">
                Senha
              </FieldLabel>
              <Link
                href="/esqueci-senha"
                className="ml-auto text-sm text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                Esqueceu sua senha?
              </Link>
            </div>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={(event) =>
                updateField("password", event.target.value)
              }
              aria-invalid={!!fieldErrors.password}
              aria-describedby={
                fieldErrors.password ? "login-password-error" : undefined
              }
              className="h-10"
            />
            {fieldErrors.password ? (
              <FieldError id="login-password-error">
                {fieldErrors.password}
              </FieldError>
            ) : null}
          </Field>

          <Field>
            <Button
              type="submit"
              size="lg"
              className="h-10 w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </Field>

          <AuthDivider surface="page" />

          <Field>
            <GoogleSignInButton />
          </Field>

          <AuthSwitchLink
            prompt="Ainda não tem uma conta?"
            linkText="Criar conta"
            href="/register"
          />
        </FieldGroup>
      </form>
    </AuthPageShell>
  )
}
