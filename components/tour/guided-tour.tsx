"use client"

import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { CheckIcon, LoaderCircleIcon, SparklesIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  TOUR_STEPS,
  TOUR_TOTAL,
  achievementsUntil,
  resolveRoute,
} from "@/lib/tour"
import {
  endDemoChat,
  onDemoChatDone,
  onDemoSave,
  requestDemoChat,
} from "@/lib/tour-chat"
import { cn } from "@/lib/utils"

const emptySubscribe = () => () => {}
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PADDING = 8
const CARD_WIDTH = 376

/**
 * Tour guiado da primeira sessão.
 *
 * Navega sozinho entre as telas, reproduz a conversa roteirizada com a IA, cria o projeto
 * de exemplo no passo certo e destaca os elementos marcados com `data-tour`. A conclusão
 * fica registrada no banco, então o tour não reaparece em outro navegador.
 */
export function GuidedTour({
  initialProjectId,
  onFinish,
}: {
  initialProjectId: string | null
  onFinish: () => void
}) {
  const isClient = useIsClient()
  const router = useRouter()
  const pathname = usePathname()

  const [stepIndex, setStepIndex] = useState(0)
  const [projectId, setProjectId] = useState<string | null>(initialProjectId)
  const [isBusy, setIsBusy] = useState(false)
  // Passos de conversa só liberam o avanço depois que a demonstração termina.
  const [chatDoneAt, setChatDoneAt] = useState<number | null>(null)
  // O retângulo medido guarda o passo a que pertence: ao avançar, o destaque anterior é
  // descartado na hora, em vez de ficar sob a explicação do passo seguinte.
  const [measured, setMeasured] = useState<{ step: number; rect: Rect } | null>(null)
  // Passo cujo alvo não apareceu a tempo: o card segue centralizado, sem aviso de carga.
  const [desistiuEm, setDesistiuEm] = useState<number | null>(null)

  const step = TOUR_STEPS[stepIndex]
  const isLast = stepIndex === TOUR_TOTAL - 1
  const isDock = step.placement === "dock"
  const rect = !isDock && measured?.step === stepIndex ? measured.rect : null
  const waitingChat = Boolean(step.chat) && chatDoneAt !== stepIndex
  // A tela do passo ainda está buscando dados: o destaque aparece assim que ela montar.
  const carregandoTela = Boolean(step.target) && !isDock && !rect && desistiuEm !== stepIndex
  const achievements = achievementsUntil(stepIndex)

  // Referências para os ouvintes de eventos sempre verem o estado atual.
  const advanceRef = useRef<() => void>(() => {})

  /* ---- navega para a tela do passo ---- */

  useEffect(() => {
    const destino = resolveRoute(step.route, projectId)
    if (!destino) return
    const atual = `${pathname}${window.location.search}`
    // Compara caminho e query: o passo de requisitos muda só o ?step= da mesma página.
    if (atual !== destino) router.push(destino)
  }, [stepIndex, step.route, projectId, pathname, router])

  /* ---- conversa roteirizada ---- */

  useEffect(() => {
    if (!step.chat) return
    const segment = step.chat
    const stop = onDemoChatDone((done) => {
      if (done === segment) setChatDoneAt(stepIndex)
    })
    requestDemoChat(segment)
    return stop
  }, [stepIndex, step.chat])

  /* ---- acompanha a posição do elemento destacado ---- */

  useEffect(() => {
    if (!step.target || isDock) return
    let timer = 0
    let tentativas = 0

    function medir() {
      const alvo = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (!alvo) {
        // A tela do passo pode ainda estar carregando dados: tenta por alguns segundos.
        // Enquanto isso o card fica centralizado, sem destaque.
        if (tentativas++ < 80) timer = window.setTimeout(medir, 150)
        else setDesistiuEm(stepIndex)
        return
      }

      const r = alvo.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) {
        alvo.scrollIntoView({ block: "center", behavior: "smooth" })
      }

      setMeasured({
        step: stepIndex,
        rect: {
          top: r.top - PADDING,
          left: r.left - PADDING,
          width: r.width + PADDING * 2,
          height: r.height + PADDING * 2,
        },
      })
      timer = window.setTimeout(medir, 400)
    }

    medir()
    return () => window.clearTimeout(timer)
  }, [stepIndex, step.target, isDock, pathname])

  /* ---- conclusão ---- */

  const finalizar = useCallback(async () => {
    if (isBusy) return
    setIsBusy(true)
    endDemoChat()
    try {
      await fetch("/api/user/tour", { method: "PATCH" })
    } catch (error) {
      console.error(error)
    } finally {
      onFinish()
    }
  }, [isBusy, onFinish])

  /* ---- avanço ---- */

  const avancar = useCallback(async () => {
    if (isBusy || waitingChat) return

    if (isLast) {
      void finalizar()
      return
    }

    if (step.action === "create-project") {
      setIsBusy(true)
      try {
        const res = await fetch("/api/user/tour", { method: "POST" })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || "Não foi possível criar o projeto")
        setProjectId(data.projectId)
        // A conversa já cumpriu o papel; o chat descarta a demonstração ao sair da tela.
        endDemoChat()
      } catch (error) {
        console.error(error)
        toast.error(error instanceof Error ? error.message : "Não foi possível criar o projeto.")
        setIsBusy(false)
        return
      }
      setIsBusy(false)
    }

    setStepIndex((i) => Math.min(i + 1, TOUR_TOTAL - 1))
  }, [isBusy, waitingChat, isLast, step.action, finalizar])

  useEffect(() => {
    advanceRef.current = () => void avancar()
  }, [avancar])

  // Clicar no próprio "Salvar requisitos" durante a demonstração também avança.
  useEffect(() => onDemoSave(() => advanceRef.current()), [])

  const voltar = useCallback(() => {
    // Não volta para antes da criação do projeto: a conversa já foi descartada.
    setStepIndex((i) => {
      const anterior = Math.max(i - 1, 0)
      if (projectId && TOUR_STEPS[anterior].action === "create-project") return i
      return anterior
    })
  }, [projectId])

  /* ---- teclado ---- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void finalizar()
      if (e.key === "ArrowRight") advanceRef.current()
      if (e.key === "ArrowLeft") voltar()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [finalizar, voltar])

  if (!isClient) return null

  // Posição do card: ancorado no canto durante a conversa; abaixo ou acima do destaque;
  // centralizado quando não há alvo.
  const cardStyle: React.CSSProperties = isDock
    ? { left: 16, bottom: 16 }
    : rect
      ? (() => {
          const abaixo = rect.top + rect.height + 16
          const cabeAbaixo = abaixo + 280 < window.innerHeight
          return {
            top: cabeAbaixo ? abaixo : Math.max(16, rect.top - 280),
            left: Math.min(
              Math.max(16, rect.left + rect.width / 2 - CARD_WIDTH / 2),
              Math.max(16, window.innerWidth - CARD_WIDTH - 16)
            ),
          }
        })()
      : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }

  const podeVoltar = stepIndex > 0 && !(projectId && TOUR_STEPS[stepIndex - 1].action === "create-project")

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[200]", isDock && "pointer-events-none")}
      role="dialog"
      aria-label="Tour guiado do FlowBot"
    >
      {/* Escurecimento: recorte no elemento destacado, tela inteira sem alvo, nada no modo dock */}
      {!isDock &&
        (rect ? (
          <div
            className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow: "0 0 0 9999px rgba(2, 10, 32, 0.68)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[rgba(2,10,32,0.68)]" />
        ))}

      {/* Card do passo */}
      <div
        key={stepIndex}
        style={cardStyle}
        className={cn(
          "animate-fade-in-up pointer-events-auto absolute rounded-2xl border border-border bg-card p-4 shadow-2xl",
          isDock ? "w-[min(20rem,calc(100vw-2rem))]" : "w-[min(23.5rem,calc(100vw-2rem))]"
        )}
      >
        <div className="flex items-start gap-3">
          <Image src="/images/robo-flowbot.png" alt="" width={40} height={40} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{step.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="-mr-1 -mt-1 size-7 shrink-0 text-muted-foreground"
            aria-label="Encerrar tour"
            onClick={finalizar}
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        {/* Progresso e conquistas */}
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Passo {stepIndex + 1} de {TOUR_TOTAL}
            </span>
            {achievements.length > 0 && (
              <span className="inline-flex items-center gap-1 text-primary">
                <SparklesIcon className="size-3" aria-hidden />
                {achievements.length} conquista(s)
              </span>
            )}
          </div>
          <div className="flex gap-1" aria-hidden>
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-primary" : "bg-border"
                )}
              />
            ))}
          </div>
          {carregandoTela && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
              Carregando a tela…
            </p>
          )}
          {step.achievement && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckIcon className="size-3.5" aria-hidden />
              {step.achievement}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={isBusy}
            onClick={finalizar}
          >
            Pular tour
          </Button>
          <div className="flex gap-2">
            {podeVoltar && (
              <Button size="sm" variant="outline" disabled={isBusy} onClick={voltar}>
                Voltar
              </Button>
            )}
            <Button size="sm" disabled={isBusy || waitingChat} onClick={() => void avancar()}>
              {waitingChat
                ? "A IA está respondendo..."
                : isBusy
                  ? "Aguarde..."
                  : isLast
                    ? "Concluir tour"
                    : (step.nextLabel ?? "Próximo")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
