"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ChatPage from "@/components/chatbot"

function DashboardChatContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isNewAiSession = searchParams.get("new") === "ai"
  const sessionKey = searchParams.get("t") ?? "default"

  useEffect(() => {
    if (isNewAiSession) {
      router.replace("/dashboard")
    }
  }, [isNewAiSession, router])

  // "Gerar sugestões com IA" (?new=ai) começa do zero; abrir o painel normalmente reabre a
  // conversa em andamento.
  return <ChatPage key={sessionKey} fresh={isNewAiSession} />
}

export default function Page() {
  return (
    <Suspense>
      <DashboardChatContent />
    </Suspense>
  )
}
