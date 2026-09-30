"use client"

import Link from "next/link"
import { FlowbotBrandLogo } from "@/components/flowbot-brand-logo"
import { signIn } from "next-auth/react"
import { useState } from "react"

import BackgroundAnimation from "@/components/background-animation"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FieldDescription, FieldSeparator } from "@/components/ui/field"
import { cn } from "@/lib/utils"

const GOOGLE_CALLBACK_URL = "/dashboard"

function AuthThemeToggle() {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-20">
      <div className="pointer-events-auto rounded-lg border border-border bg-card shadow-sm">
        <ThemeToggle />
      </div>
    </div>
  )
}

export function AuthPageShell({
  children,
  className,
  presentation,
  ...rest
}: {
  children: React.ReactNode
  className?: string
  presentation?: React.ReactNode
} & Omit<React.ComponentProps<"div">, "children">) {
  return (
    <>
      <BackgroundAnimation />
      <AuthThemeToggle />
      {presentation ? (
        <div
          className={cn(
            "relative z-10 min-h-svh overflow-x-hidden p-4 sm:p-6 lg:p-8",
            className
          )}
          {...rest}
        >
          <div className="mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-md items-center sm:min-h-[calc(100svh-3rem)] lg:max-w-[70rem] lg:min-h-[calc(100svh-4rem)]">
            <div className="grid w-full overflow-hidden rounded-2xl border border-border bg-card shadow-md lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <div className="flex flex-col justify-center bg-card px-6 py-8 sm:px-10 lg:px-12">
                <div className="mx-auto w-full max-w-[24rem]">{children}</div>
              </div>
              {presentation}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative z-10 flex min-h-svh flex-col items-center justify-center p-4 sm:p-6 md:p-10",
            className
          )}
          {...rest}
        >
          <div className="w-full max-w-md">{children}</div>
        </div>
      )}
    </>
  )
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-border bg-card shadow-md">
      <CardContent className="p-6 sm:p-8">{children}</CardContent>
    </Card>
  )
}

export function AuthLogo({
  align = "center",
}: {
  align?: "center" | "start"
}) {
  return (
    <div
      className={cn(
        "mb-6 flex px-0 sm:px-2",
        align === "center" ? "justify-center" : "justify-start"
      )}
    >
      <FlowbotBrandLogo variant="auth" priority />
    </div>
  )
}

export function AuthHeader({
  title,
  description,
  align = "center",
}: {
  title: string
  description?: string
  align?: "center" | "start"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        description ? "mb-6" : "mb-5",
        align === "center" ? "text-center" : "text-left"
      )}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-navy dark:text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export function AuthDivider({
  surface = "card",
}: {
  surface?: "card" | "page"
}) {
  return (
    <FieldSeparator
      className={
        surface === "page"
          ? "*:data-[slot=field-separator-content]:bg-background"
          : "*:data-[slot=field-separator-content]:bg-card"
      }
    >
      ou
    </FieldSeparator>
  )
}

export function GoogleSignInButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn("google", { callbackUrl: GOOGLE_CALLBACK_URL })
    } catch (error) {
      console.error("Erro ao entrar com Google:", error)
      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full border-border bg-background text-foreground hover:bg-muted"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      aria-busy={isLoading}
    >
      {isLoading ? (
        "Conectando..."
      ) : (
        <>
          <GoogleIcon />
          Continuar com Google
        </>
      )}
    </Button>
  )
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
    >
      <path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        fill="currentColor"
      />
    </svg>
  )
}

export function AuthSwitchLink({
  prompt,
  linkText,
  href,
}: {
  prompt: string
  linkText: string
  href: string
}) {
  return (
    <FieldDescription className="text-center text-foreground/80">
      {prompt}{" "}
      <Link
        href={href}
        className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {linkText}
      </Link>
    </FieldDescription>
  )
}

export function AuthLegalNotice() {
  return (
    <FieldDescription className="mt-6 px-2 text-center text-xs text-muted-foreground">
      Ao continuar, você concorda com nossos Termos de Serviço e Política de
      Privacidade.
    </FieldDescription>
  )
}

export function AuthUnavailableNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2.5 text-sm text-foreground"
    >
      {message}
    </div>
  )
}
