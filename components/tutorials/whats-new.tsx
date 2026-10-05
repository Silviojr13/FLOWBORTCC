"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { PAGE_TUTORIALS, startTutorials, type PageTutorial } from "@/lib/page-tutorials"
import { extractActiveProjectId } from "@/lib/project-nav"

const SEEN_PREFIX = "novidade:"
/** Espera a tela assentar antes de avisar (e não disputar espaço com o carregamento). */
const DELAY_MS = 2500

interface TutorialStatus {
  progress: Record<string, string>
  joinedAt: string | null
  tourDone: boolean
}

function markSeen(keys: string[]) {
  fetch("/api/user/tutorials", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seen: keys }),
  }).catch(() => {})
}

/** Telas que chegaram depois que a pessoa entrou e que ela ainda não viu nem dispensou. */
function pendingNews(status: TutorialStatus): PageTutorial[] {
  if (!status.joinedAt || !status.tourDone) return []
  const joined = new Date(status.joinedAt).getTime()
  return PAGE_TUTORIALS.filter(
    (t) =>
      t.since &&
      new Date(`${t.since}T23:59:59`).getTime() > joined &&
      !status.progress[t.key] &&
      !status.progress[`${SEEN_PREFIX}${t.key}`]
  )
}

async function projectForTutorials(pathname: string): Promise<string | null> {
  const here = extractActiveProjectId(pathname)
  if (here) return here
  const data = await fetch("/api/projects")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
  const projects: { id: string; isTutorial?: boolean }[] = data?.projects ?? []
  return (projects.find((p) => !p.isTutorial) ?? projects[0])?.id ?? null
}

/**
 * Aviso de novidade: quando entra uma tela nova no FlowBot, quem já usava a plataforma
 * recebe, uma única vez, o convite para o tutorial dela. Quem chegou depois aprende pelo
 * tour inicial e pela central de tutoriais, sem aviso.
 */
export function WhatsNew() {
  // Só na primeira tela da sessão: o layout fica montado ao navegar.
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const status: TutorialStatus | null = await fetch("/api/user/tutorials")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      if (cancelled || !status) return

      let news = pendingNews(status)
      if (news.length === 0) return
      const projectId = await projectForTutorials(window.location.pathname)
      if (cancelled) return
      // Tutoriais de projeto precisam de um projeto aberto.
      if (!projectId) news = news.filter((t) => t.scope === "geral")
      if (news.length === 0) return

      const keys = news.map((t) => t.key)
      const names = news.map((t) => t.title)
      const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`
      toast(names.length === 1 ? "Novidade no FlowBot" : `${names.length} novidades no FlowBot`, {
        description: `${list}. Quer ver o tutorial${names.length === 1 ? "" : " de cada uma"}?`,
        duration: Infinity,
        action: {
          label: names.length === 1 ? "Ver tutorial" : "Ver tutoriais",
          onClick: () => {
            markSeen(keys)
            startTutorials({ keys, projectId })
          },
        },
        cancel: { label: "Agora não", onClick: () => markSeen(keys) },
      })
    }, DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return null
}
