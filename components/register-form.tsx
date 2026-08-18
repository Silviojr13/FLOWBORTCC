"use client"

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
  registerSchema,
  type RegisterFormValues,
} from "@/lib/auth-schemas"
import { cn } from "@/lib/utils"

const UNAVAILABLE_MESSAGE =
  "Cadastro por e-mail e senha ainda não está disponível. Use o Google para criar sua conta."

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [values, setValues] = useState<RegisterFormValues>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof RegisterFormValues, string>>
  >({})
  const [formNotice, setFormNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (field: keyof RegisterFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setFormNotice(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormNotice(null)

    const result = registerSchema.safeParse(values)
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

  return (
    <AuthPageShell className={cn(className)} {...props}>
      <AuthCard>
        <AuthLogo />
        <AuthHeader
          title="Crie sua conta"
          description="Comece a organizar seu projeto de robótica com o Flowbot."
        />

        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            {formNotice ? <AuthUnavailableNotice message={formNotice} /> : null}

            <Field data-invalid={!!fieldErrors.name}>
              <FieldLabel htmlFor="register-name" className="text-foreground">
                Nome
              </FieldLabel>
              <Input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Seu nome"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                aria-invalid={!!fieldErrors.name}
                aria-describedby={
                  fieldErrors.name ? "register-name-error" : undefined
                }
              />
              {fieldErrors.name ? (
                <FieldError id="register-name-error">
                  {fieldErrors.name}
                </FieldError>
              ) : null}
            </Field>

            <Field data-invalid={!!fieldErrors.email}>
              <FieldLabel htmlFor="register-email" className="text-foreground">
                E-mail
              </FieldLabel>
              <Input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={
                  fieldErrors.email ? "register-email-error" : undefined
                }
              />
              {fieldErrors.email ? (
                <FieldError id="register-email-error">
                  {fieldErrors.email}
                </FieldError>
              ) : null}
            </Field>

            <Field data-invalid={!!fieldErrors.password}>
              <FieldLabel
                htmlFor="register-password"
                className="text-foreground"
              >
                Senha
              </FieldLabel>
              <Input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
                aria-invalid={!!fieldErrors.password}
                aria-describedby={
                  fieldErrors.password ? "register-password-error" : undefined
                }
              />
              {fieldErrors.password ? (
                <FieldError id="register-password-error">
                  {fieldErrors.password}
                </FieldError>
              ) : null}
            </Field>

            <Field data-invalid={!!fieldErrors.confirmPassword}>
              <FieldLabel
                htmlFor="register-confirm-password"
                className="text-foreground"
              >
                Confirmar senha
              </FieldLabel>
              <Input
                id="register-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={(event) =>
                  updateField("confirmPassword", event.target.value)
                }
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={
                  fieldErrors.confirmPassword
                    ? "register-confirm-password-error"
                    : undefined
                }
              />
              {fieldErrors.confirmPassword ? (
                <FieldError id="register-confirm-password-error">
                  {fieldErrors.confirmPassword}
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
                {isSubmitting ? "Criando conta..." : "Criar conta"}
              </Button>
            </Field>

            <AuthDivider />

            <Field>
              <GoogleSignInButton />
            </Field>

            <AuthSwitchLink
              prompt="Já possui uma conta?"
              linkText="Entrar"
              href="/login"
            />
          </FieldGroup>
        </form>
      </AuthCard>

      <AuthLegalNotice />
    </AuthPageShell>
  )
}
