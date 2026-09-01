"use client"

import { useRouter } from "next/navigation"
import { SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"

export function AiChatAssistButton({
  label = "Gerar sugestões com IA",
}: {
  label?: string
}) {
  const router = useRouter()
  const { setOpen } = useSidebar()

  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
      onClick={() => {
        setOpen(false)
        router.push(`/dashboard?new=ai&t=${Date.now()}`)
      }}
    >
      <SparklesIcon className="size-4" />
      {label}
    </Button>
  )
}
