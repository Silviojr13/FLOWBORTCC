"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import {
  Building2,
  CalendarDays,
  ChartColumn,
  Check,
  CircleUserRound,
  ClipboardList,
  CodeXml,
  Cpu,
  Ellipsis,
  EyeOff,
  FlaskConical,
  GraduationCap,
  Kanban,
  Presentation,
  Search,
  Share2,
  type LucideIcon,
} from "lucide-react"

import { FlowbotBrandLogo } from "@/components/flowbot-brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DISCOVERY_OPTIONS,
  PROFILE_OPTIONS,
  greetingName,
  type DiscoveryValue,
  type ProfileValue,
} from "@/lib/onboarding"
import { cn } from "@/lib/utils"

const CONCEPTS = [
  { label: "Estruture", icon: ClipboardList },
  { label: "Desenvolva", icon: Kanban },
  { label: "Acompanhe", icon: ChartColumn },
] as const

const PROFILE_ICONS: Record<ProfileValue, LucideIcon> = {
  estudante: GraduationCap,
  professor: Presentation,
  pesquisador: FlaskConical,
  desenvolvedor: CodeXml,
  entusiasta: Cpu,
  outro: Ellipsis,
  prefer_not: EyeOff,
}

const DISCOVERY_ICONS: Record<DiscoveryValue, LucideIcon> = {
  faculdade: Building2,
  indicacao: CircleUserRound,
  professor: Presentation,
  redes_sociais: Share2,
  pesquisa: Search,
  evento: CalendarDays,
  outro: Ellipsis,
  prefer_not: EyeOff,
}

type Step = 1 | 2 | 3

type Answers = {
  profile: ProfileValue | null
  discoverySource: DiscoveryValue | null
}

export function OnboardingFlow({ userName }: { userName: string | null }) {
  const router = useRouter()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const submittingRef = useRef(false)
  const [step, setStep] = useState<Step>(1)
  const [profile, setProfile] = useState<ProfileValue | null>(null)
  const [discoverySource, setDiscoverySource] = useState<DiscoveryValue | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = greetingName(userName)

  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  async function finish(answers: Answers) {
    if (submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(
          typeof data?.message === "string"
            ? data.message
            : "Não foi possível salvar o onboarding. Tente novamente."
        )
        submittingRef.current = false
        setIsSubmitting(false)
        return
      }

      router.replace("/dashboard")
      router.refresh()
    } catch (cause) {
      console.error("Erro ao concluir o onboarding:", cause)
      setError(
        "Não foi possível salvar o onboarding. Verifique sua conexão e tente novamente."
      )
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed top-4 right-4 z-20">
        <div className="pointer-events-auto rounded-lg border border-border bg-card shadow-sm">
          <ThemeToggle />
        </div>
      </div>

      <main className="flex min-h-svh flex-col items-center bg-background px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex w-full max-w-xl flex-col">
          <div className="mb-6 flex justify-center">
            <FlowbotBrandLogo variant="auth" priority />
          </div>

          <OnboardingProgress step={step} />

          <div key={step} className="animate-fade-in-up">
            {step === 1 ? (
              <WelcomeStep
                headingRef={headingRef}
                name={name}
                onContinue={() => setStep(2)}
              />
            ) : null}

            {step === 2 ? (
              <QuestionStep
                headingRef={headingRef}
                title="Queremos conhecer você!"
                subtitle="Qual dessas opções melhor descreve você?"
                name="profile"
                options={PROFILE_OPTIONS}
                icons={PROFILE_ICONS}
                value={profile}
                onChange={setProfile}
                disabled={isSubmitting}
                onBack={() => setStep(1)}
                onSkip={() => {
                  setProfile(null)
                  setStep(3)
                }}
                onContinue={() => setStep(3)}
                continueLabel="Continuar"
              />
            ) : null}

            {step === 3 ? (
              <QuestionStep
                headingRef={headingRef}
                title="Como você conheceu o Flowbot?"
                subtitle="Sua resposta nos ajuda a melhorar e alcançar mais pessoas."
                name="discovery"
                options={DISCOVERY_OPTIONS}
                icons={DISCOVERY_ICONS}
                value={discoverySource}
                onChange={setDiscoverySource}
                disabled={isSubmitting}
                error={error}
                onBack={() => setStep(2)}
                onSkip={() => {
                  setDiscoverySource(null)
                  void finish({ profile, discoverySource: null })
                }}
                onContinue={() => void finish({ profile, discoverySource })}
                continueLabel={isSubmitting ? "Salvando..." : "Começar no Flowbot"}
              />
            ) : null}
          </div>
        </div>
      </main>
    </>
  )
}

function OnboardingProgress({ step }: { step: Step }) {
  return (
    <div className="mb-8 flex flex-col items-center gap-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground">
        Etapa {step} de 3
      </p>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
        aria-valuetext={`Etapa ${step} de 3`}
        aria-label="Progresso do onboarding"
      >
        {[1, 2, 3].map((item) => (
          <span
            key={item}
            aria-hidden="true"
            className={cn(
              "h-1 w-8 rounded-full motion-safe:transition-colors",
              item <= step ? "bg-primary" : "bg-border"
            )}
          />
        ))}
      </div>
    </div>
  )
}

function WelcomeStep({
  headingRef,
  name,
  onContinue,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  name: string | null
  onContinue: () => void
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <Image
        src="/images/robo-flowbot.png"
        alt="Mascote do Flowbot"
        width={160}
        height={160}
        priority
        className="animate-float-soft mb-6 h-auto w-28 object-contain sm:w-32"
      />

      {name ? (
        <p className="mb-2 text-sm font-medium text-primary">Olá, {name}.</p>
      ) : null}

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight text-navy outline-none sm:text-3xl dark:text-foreground"
      >
        Boas-vindas ao Flowbot!
      </h1>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
        Transforme suas ideias de robótica em projetos organizados e acompanhe
        cada etapa do desenvolvimento com o apoio da inteligência artificial.
      </p>

      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {CONCEPTS.map((concept) => {
          const Icon = concept.icon
          return (
            <li
              key={concept.label}
              className="flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <Icon className="size-3.5 text-primary" aria-hidden="true" />
              {concept.label}
            </li>
          )
        })}
      </ul>

      <Button
        type="button"
        size="lg"
        className="mt-8 min-w-48"
        onClick={onContinue}
      >
        Vamos começar
      </Button>
    </div>
  )
}

function QuestionStep<T extends string>({
  headingRef,
  title,
  subtitle,
  name,
  options,
  icons,
  value,
  onChange,
  disabled,
  error,
  onBack,
  onSkip,
  onContinue,
  continueLabel,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  title: string
  subtitle: string
  name: string
  options: readonly { value: T; label: string }[]
  icons: Record<T, LucideIcon>
  value: T | null
  onChange: (value: T) => void
  disabled: boolean
  error?: string | null
  onBack: () => void
  onSkip: () => void
  onContinue: () => void
  continueLabel: string
}) {
  const errorId = useId()

  return (
    <div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-center text-2xl font-semibold tracking-tight text-navy outline-none sm:text-3xl dark:text-foreground"
      >
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
        {subtitle}
      </p>

      <OptionGroup
        className="mt-6"
        name={name}
        legend={subtitle}
        options={options}
        icons={icons}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />

      {disabled ? (
        <p className="sr-only" role="status">
          Salvando suas respostas.
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={disabled}
        >
          Voltar
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={disabled}
            aria-label="Pular esta pergunta"
          >
            Pular
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onContinue}
            disabled={disabled}
            aria-busy={disabled}
            aria-describedby={error ? errorId : undefined}
          >
            {continueLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function OptionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
}

function OptionGroup<T extends string>({
  className,
  name,
  legend,
  options,
  icons,
  value,
  onChange,
  disabled,
}: {
  className?: string
  name: string
  legend: string
  options: readonly { value: T; label: string }[]
  icons: Record<T, LucideIcon>
  value: T | null
  onChange: (value: T) => void
  disabled: boolean
}) {
  return (
    <fieldset className={className} disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.value
          const declines = option.value === "prefer_not"

          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                "hover:border-primary/40 hover:bg-muted",
                "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                declines && "sm:col-span-2",
                selected
                  ? "border-primary bg-blue-light font-medium text-foreground shadow-sm"
                  : "border-border bg-card text-foreground shadow-sm dark:shadow-none",
                disabled && "pointer-events-none opacity-60"
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <OptionIcon icon={icons[option.value] as LucideIcon} />
              <span className="flex-1 leading-snug">{option.label}</span>
              <Check
                className={cn(
                  "size-4 shrink-0 text-primary",
                  selected ? "opacity-100" : "opacity-0"
                )}
                aria-hidden="true"
              />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
