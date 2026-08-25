"use client"

import Link from "next/link"
import { useState } from "react"

import {
  AuthCard,
  AuthDivider,
  AuthHeader,
  AuthLegalNotice,
  AuthLogo,
  AuthPageShell,
  AuthSwitchLink,
  AuthUnavailableNotice,
  GoogleSignInButton,
} from "@/components/auth/auth-layout"
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

const UNAVAILABLE_MESSAGE =
  "Autenticação por e-mail e senha ainda não está disponível. Use o Google para entrar."

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
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

    // Backend convencional ainda não implementado — informar explicitamente.
    setFormNotice(UNAVAILABLE_MESSAGE)
    setIsSubmitting(false)
  }

  const handleForgotPassword = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    setFormNotice(
      "Recuperação de senha ainda não está disponível. Entre com o Google ou tente novamente mais tarde."
    )
  }

  return (
    <AuthPageShell className={cn(className)} {...props}>
      <AuthCard>
        <AuthLogo />
        <AuthHeader
          title="Bem-vindo de volta"
          description="Entre na sua conta para continuar no Flowbot."
        />

        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            {formNotice ? <AuthUnavailableNotice message={formNotice} /> : null}

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
                  href="#"
                  onClick={handleForgotPassword}
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
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </Field>

            <AuthDivider />

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
      </AuthCard>

      <AuthLegalNotice />
    </AuthPageShell>
  )
}
