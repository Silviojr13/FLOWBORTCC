"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ClipboardListIcon, SparklesIcon } from "lucide-react"
import { workspaceGutter } from "@/components/layout/workspace"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export default function NewProjectChoicePage() {
  const router = useRouter()
  const { setOpen, setOpenMobile } = useSidebar()

  function beginCreation(href: string) {
    setOpen(false)
    setOpenMobile(false)
    router.push(href)
  }

  return (
    <div className={cn("mx-auto flex w-full max-w-3xl flex-col gap-8 py-4 sm:py-8", workspaceGutter)}>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Como você quer começar seu projeto?
        </h1>
      </div>

      <div data-tour="new-project-options" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => beginCreation(`/dashboard?new=ai&t=${Date.now()}`)}
          className={cn(
            "flex h-full cursor-pointer flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-5 text-left shadow-sm transition-colors dark:shadow-none",
            "hover:border-primary hover:bg-primary/15",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <SparklesIcon className="size-5" />
          </span>
          <span className="text-base font-semibold text-foreground">Criar com IA</span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            O Flowbot conversa com você, entende sua ideia e ajuda a estruturar o projeto passo a passo.
          </span>
        </button>

        <Link
          href="/dashboard/projects/new/manual"
          onClick={() => {
            setOpen(false)
            setOpenMobile(false)
          }}
          className={cn(
            "flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors dark:shadow-none",
            "hover:border-primary/30 hover:bg-accent",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground">
            <ClipboardListIcon className="size-5" />
          </span>
          <span className="text-base font-semibold text-foreground">Criar manualmente</span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            Estruture o projeto diretamente, ideal para quem já sabe o que deseja criar.
          </span>
        </Link>
      </div>
    </div>
  )
}
