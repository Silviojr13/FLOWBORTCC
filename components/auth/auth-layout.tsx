"use client"

import Image from "next/image"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useState } from "react"

import BackgroundAnimation from "@/components/background-animation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FieldDescription, FieldSeparator } from "@/components/ui/field"
import { cn } from "@/lib/utils"

const GOOGLE_CALLBACK_URL = "/dashboard"

export function AuthPageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <>
      <BackgroundAnimation />
      <div
        className={cn(
          "relative z-10 flex min-h-svh flex-col items-center justify-center p-4 sm:p-6 md:p-10",
          className
        )}
      >
        <div className="w-full max-w-md">{children}</div>
      </div>
    </>
  )
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-lg shadow-black/30 backdrop-blur-sm">
      <CardContent className="p-6 sm:p-8">{children}</CardContent>
    </Card>
  )
}

export function AuthLogo() {
  return (
    <div className="mb-6 flex justify-center px-2">
      <Image
        src="/flowbot_name.svg"
        alt="Flowbot"
        width={220}
        height={37}
        className="h-9 w-auto max-w-full sm:h-10"
        priority
      />
    </div>
  )
}

export function AuthHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-6 flex flex-col gap-2 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

export function AuthDivider() {
  return (
    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
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
