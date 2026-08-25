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

  return <ChatPage key={sessionKey} />
}

export default function Page() {
  return (
    <Suspense>
      <DashboardChatContent />
    </Suspense>
  )
}
