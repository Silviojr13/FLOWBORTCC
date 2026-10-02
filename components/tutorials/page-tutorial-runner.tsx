"use client"

import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { LoaderCircleIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  TUTORIAL_START_EVENT,
  getPageTutorial,
  type TutorialRequest,
} from "@/lib/page-tutorials"

export const TUTORIAL_PROGRESS_EVENT = "flowbot:tutoriais-progresso"

const emptySubscribe = () => () => {}
function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PADDING = 8
const CARD_WIDTH = 368

function markDone(key: string) {
  fetch("/api/user/tutorials", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  })
    .then(() => window.dispatchEvent(new CustomEvent(TUTORIAL_PROGRESS_EVENT)))
    .catch(() => {})
}

/**
 * Executa um ou mais tutoriais de página em sequência. Um tutorial só = "tutorial desta
 * tela"; a sequência inteira = tutorial completo (avançado), que navega de tela em tela.
 */
export function PageTutorialRunner() {
  const isClient = useIsClient()
  const router = useRouter()
  const pathname = usePathname()

  const [run, setRun] = useState<TutorialRequest | null>(null)
  const [tutorialIndex, setTutorialIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [measured, setMeasured] = useState<{ id: string; rect: Rect } | null>(null)
  const [gaveUp, setGaveUp] = useState<string | null>(null)

  useEffect(() => {
    function onStart(e: Event) {
      const detail = (e as CustomEvent<TutorialRequest>).detail
      if (!detail?.keys?.length) return
      setRun(detail)
      setTutorialIndex(0)
      setStepIndex(0)
      setMeasured(null)
    }
    window.addEventListener(TUTORIAL_START_EVENT, onStart)
    return () => window.removeEventListener(TUTORIAL_START_EVENT, onStart)
  }, [])

  const tutorial = run ? getPageTutorial(run.keys[tutorialIndex]) : undefined
  const step = tutorial?.steps[stepIndex]
  const stepId = `${tutorialIndex}-${stepIndex}`
  const destination = run && tutorial ? tutorial.path(run.projectId) : null
  const target = step?.target

  // Leva à tela do tutorial atual (no tutorial completo, a cada troca de tela).
  useEffect(() => {
    if (!destination) return
    const current = `${pathname}${window.location.search}`
    if (current !== destination) router.push(destination)
  }, [destination, pathname, router])

  // Acompanha a posição do elemento destacado; a tela pode ainda estar carregando dados.
  useEffect(() => {
    if (!target) return
    let timer = 0
    let attempts = 0
    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
      if (!el) {
        if (attempts++ < 60) timer = window.setTimeout(measure, 150)
        else setGaveUp(stepId)
        return
      }
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center", behavior: "smooth" })
      setMeasured({
        id: stepId,
        rect: { top: r.top - PADDING, left: r.left - PADDING, width: r.width + PADDING * 2, height: r.height + PADDING * 2 },
      })
      timer = window.setTimeout(measure, 400)
    }
    measure()
    return () => window.clearTimeout(timer)
  }, [stepId, target, pathname])

  const close = useCallback((finished: boolean) => {
    setRun(null)
    setMeasured(null)
    if (finished) toast.success("Tutorial concluído.")
  }, [])

  const next = useCallback(() => {
    if (!run || !tutorial) return
    if (stepIndex < tutorial.steps.length - 1) {
      setStepIndex((i) => i + 1)
      return
    }
    markDone(tutorial.key)
    if (tutorialIndex < run.keys.length - 1) {
      setTutorialIndex((i) => i + 1)
      setStepIndex(0)
    } else {
      close(true)
    }
  }, [run, tutorial, stepIndex, tutorialIndex, close])

  const previous = useCallback(() => {
    if (!run) return
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1)
      return
    }
    if (tutorialIndex > 0) {
      const before = getPageTutorial(run.keys[tutorialIndex - 1])
      setTutorialIndex((i) => i - 1)
      setStepIndex(Math.max(0, (before?.steps.length ?? 1) - 1))
    }
  }, [run, stepIndex, tutorialIndex])

  useEffect(() => {
    if (!run) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false)
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") previous()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [run, next, previous, close])

  if (!isClient || !run || !tutorial || !step) return null

  const rect = step.target && measured?.id === stepId ? measured.rect : null
  const onPage = destination === `${pathname}${typeof window === "undefined" ? "" : window.location.search}`
  const loading = Boolean(step.target) && !rect && gaveUp !== stepId
  const isChain = run.keys.length > 1
  const isLastStep = stepIndex === tutorial.steps.length - 1
  const isLastTutorial = tutorialIndex === run.keys.length - 1
  const canGoBack = stepIndex > 0 || tutorialIndex > 0

  const cardStyle: React.CSSProperties = rect
    ? (() => {
        const below = rect.top + rect.height + 14
        const fitsBelow = below + 250 < window.innerHeight
        return {
          top: fitsBelow ? below : Math.max(16, rect.top - 250),
          left: Math.min(
            Math.max(16, rect.left + rect.width / 2 - CARD_WIDTH / 2),
            Math.max(16, window.innerWidth - CARD_WIDTH - 16)
          ),
        }
      })()
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }

  return createPortal(
    <div className="fixed inset-0 z-[150]" role="dialog" aria-label={`Tutorial: ${tutorial.title}`}>
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{ ...rect, boxShadow: "0 0 0 9999px rgba(2, 10, 32, 0.6)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(2,10,32,0.6)]" />
      )}

      <div
        key={stepId}
        style={cardStyle}
        className="animate-fade-in-up absolute w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <Image src="/images/robo-flowbot.png" alt="" width={36} height={36} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium tracking-wide text-primary uppercase">
              {isChain ? `Tela ${tutorialIndex + 1} de ${run.keys.length} · ` : "Tutorial · "}
              {tutorial.title}
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug">{step.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="-mt-1 -mr-1 size-7 shrink-0 text-muted-foreground"
            aria-label="Sair do tutorial"
            onClick={() => close(false)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-1" aria-hidden>
          {tutorial.steps.map((_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i <= stepIndex ? "bg-primary" : "bg-border")} />
          ))}
        </div>
        {(loading || !onPage) && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
            Carregando a tela…
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Passo {stepIndex + 1} de {tutorial.steps.length}
          </span>
          <div className="flex gap-2">
            {canGoBack && (
              <Button size="sm" variant="outline" onClick={previous}>
                Voltar
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLastStep ? (isLastTutorial ? "Concluir" : "Próxima tela") : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
