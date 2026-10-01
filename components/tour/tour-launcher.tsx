"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GuidedTour } from "@/components/tour/guided-tour"
import { TOUR_START_EVENT, TOUR_TOTAL } from "@/lib/tour"

type Estado = "verificando" | "convite" | "preparando" | "rodando" | "encerrado"

/**
 * Decide se o tour guiado deve ser oferecido ao entrar no painel.
 *
 * Fica montado no layout do dashboard: na primeira sessão convida o usuário, cria o projeto
 * de exemplo e entrega o controle ao GuidedTour. Depois de concluído ou pulado, não aparece
 * mais — o estado fica no banco, não no navegador.
 */
export function TourLauncher() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>("verificando")
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    fetch("/api/user/tour")
      .then(async (res) => {
        if (!res.ok) throw new Error("Falha ao consultar o tour")
        return res.json()
      })
      .then((data: { completed: boolean; projectId: string | null }) => {
        if (cancelado) return
        setProjectId(data.projectId)
        setEstado(data.completed ? "encerrado" : "convite")
      })
      .catch(() => {
        if (!cancelado) setEstado("encerrado")
      })

    return () => {
      cancelado = true
    }
  }, [])

  // Permite reabrir o tour pelo menu do usuário, mesmo depois de concluído.
  useEffect(() => {
    function aoPedirTour() {
      setEstado((atual) => (atual === "rodando" ? atual : "convite"))
    }
    window.addEventListener(TOUR_START_EVENT, aoPedirTour)
    return () => window.removeEventListener(TOUR_START_EVENT, aoPedirTour)
  }, [])

  // O projeto de exemplo não é criado aqui: ele nasce durante o tour, quando a conversa
  // com a IA termina e o usuário clica em "Criar o projeto".
  function comecar() {
    setEstado("rodando")
  }

  async function dispensar() {
    setEstado("encerrado")
    try {
      await fetch("/api/user/tour", { method: "PATCH" })
    } catch (error) {
      console.error(error)
    }
  }

  if (estado === "verificando" || estado === "encerrado") return null

  if (estado === "rodando") {
    return (
      <GuidedTour
        initialProjectId={projectId}
        onFinish={() => {
          setEstado("encerrado")
          toast.success("Tour concluído! O projeto de exemplo continua disponível.")
          router.refresh()
        }}
      />
    )
  }

  // Convite da primeira sessão
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(2,10,32,0.68)] p-4">
      <div className="animate-fade-in-up w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <Image
          src="/images/robo-flowbot.png"
          alt=""
          width={88}
          height={88}
          className="mx-auto"
          priority
        />
        <h2 className="mt-3 text-xl font-semibold text-foreground">
          Bem-vindo ao FlowBot!
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Quer que eu mostre como criar um projeto com a ajuda da IA e como acompanhá-lo
          depois? São {TOUR_TOTAL} passos rápidos — dá para pular a qualquer momento.
        </p>

        <ul className="mt-4 flex flex-col gap-1.5 text-left text-[13px] text-muted-foreground">
          {[
            "Você vê a IA levantar os requisitos de um braço robótico",
            "A conversa vira um projeto de exemplo para você explorar",
            "Depois conhece Kanban, custos, relatórios e o assistente",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="gap-1.5"
            disabled={estado === "preparando"}
            onClick={comecar}
          >
            <SparklesIcon className="size-4" />
            {estado === "preparando" ? "Preparando o projeto..." : "Fazer o tour guiado"}
          </Button>
          <Button variant="ghost" disabled={estado === "preparando"} onClick={dispensar}>
            Explorar por conta própria
          </Button>
        </div>
      </div>
    </div>
  )
}
