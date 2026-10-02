"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2Icon,
  CircleHelpIcon,
  GraduationCapIcon,
  PlayIcon,
  RouteIcon,
  SparklesIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TUTORIAL_PROGRESS_EVENT } from "@/components/tutorials/page-tutorial-runner"
import { startGuidedTour } from "@/lib/tour"
import {
  ADVANCED_TUTORIAL,
  HELP_CENTER_EVENT,
  PAGE_TUTORIALS,
  getPageTutorial,
  openHelpCenter,
  startTutorials,
  tutorialForLocation,
} from "@/lib/page-tutorials"
import { cn } from "@/lib/utils"

/** Botão "Ajuda" do cabeçalho: abre a central de tutoriais. */
export function HelpCenterButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground hover:text-foreground"
      onClick={() => openHelpCenter()}
      data-tour="help-center"
    >
      <CircleHelpIcon className="size-4" />
      <span className="hidden sm:inline">Tutoriais</span>
    </Button>
  )
}

/**
 * Central de tutoriais: o tutorial da tela atual, o tour para iniciantes, o tutorial
 * completo (avançado) e a lista de tutoriais por tela com o que a pessoa já concluiu.
 */
export function HelpCenter() {
  const [open, setOpen] = useState(false)
  const [here, setHere] = useState<{ key: string; projectId: string | null } | null>(null)
  const [progress, setProgress] = useState<Record<string, string>>({})
  const [fallbackProjectId, setFallbackProjectId] = useState<string | null>(null)

  const loadProgress = useCallback(() => {
    fetch("/api/user/tutorials")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setProgress(data.progress ?? {}))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onOpen() {
      setHere(tutorialForLocation(window.location.pathname, window.location.search))
      setOpen(true)
      loadProgress()
      // Tutoriais de projeto fora de um projeto usam o primeiro projeto da pessoa.
      fetch("/api/projects")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const projects: { id: string; isTutorial?: boolean }[] = data?.projects ?? []
          const own = projects.find((p) => !p.isTutorial) ?? projects[0]
          setFallbackProjectId(own?.id ?? null)
        })
        .catch(() => {})
    }
    window.addEventListener(HELP_CENTER_EVENT, onOpen)
    window.addEventListener(TUTORIAL_PROGRESS_EVENT, loadProgress)
    return () => {
      window.removeEventListener(HELP_CENTER_EVENT, onOpen)
      window.removeEventListener(TUTORIAL_PROGRESS_EVENT, loadProgress)
    }
  }, [loadProgress])

  const projectId = here?.projectId ?? fallbackProjectId
  const hereTutorial = here ? getPageTutorial(here.key) : undefined
  const doneCount = PAGE_TUTORIALS.filter((t) => progress[t.key]).length

  function start(keys: string[]) {
    setOpen(false)
    startTutorials({ keys, projectId })
  }

  async function resetProgress() {
    const res = await fetch("/api/user/tutorials", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    })
    if (res.ok) setProgress({})
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Central de tutoriais</DialogTitle>
          <DialogDescription>
            Aprenda o FlowBot no seu ritmo: pela tela em que você está, pelo tour para iniciantes ou
            por um passeio completo pelo projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full rounded-full bg-emerald-500"
                style={{ width: `${(doneCount / PAGE_TUTORIALS.length) * 100}%` }}
              />
            </div>
            <span className="tabular-nums">
              {doneCount} de {PAGE_TUTORIALS.length} telas vistas
            </span>
          </div>

          {hereTutorial && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium tracking-wide text-primary uppercase">Nesta tela</p>
                <p className="text-sm font-semibold text-foreground">{hereTutorial.title}</p>
                <p className="text-xs text-muted-foreground">{hereTutorial.summary}</p>
              </div>
              <Button onClick={() => start([hereTutorial.key])}>
                <PlayIcon />
                Iniciar
              </Button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-primary" aria-hidden />
                <p className="text-sm font-semibold text-foreground">Tour para iniciantes</p>
              </div>
              <p className="flex-1 text-xs text-muted-foreground">
                Mostra a IA criando um projeto de exemplo (um braço robótico) e passa pelos principais
                módulos. Cerca de 3 minutos.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  startGuidedTour()
                }}
              >
                Começar o tour
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <GraduationCapIcon className="size-4 text-primary" aria-hidden />
                <p className="text-sm font-semibold text-foreground">Tutorial completo</p>
              </div>
              <p className="flex-1 text-xs text-muted-foreground">
                Avançado: percorre as {ADVANCED_TUTORIAL.length} telas de um projeto, uma após a outra,
                explicando cada recurso.
              </p>
              <Button variant="outline" size="sm" disabled={!projectId} onClick={() => start(ADVANCED_TUTORIAL)}>
                <RouteIcon />
                Percorrer o projeto
              </Button>
              {!projectId && (
                <p className="text-[11px] text-muted-foreground">Crie um projeto para liberar.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">Tutoriais por tela</p>
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
              {PAGE_TUTORIALS.map((t) => {
                const done = Boolean(progress[t.key])
                const blocked = t.scope === "projeto" && !projectId
                return (
                  <li key={t.key} className="flex items-center gap-3 px-3 py-2.5">
                    <CheckCircle2Icon
                      className={cn("size-4 shrink-0", done ? "text-emerald-500" : "text-muted-foreground/30")}
                      aria-label={done ? "Concluído" : "Ainda não visto"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.summary}</p>
                    </div>
                    <Button size="sm" variant="ghost" disabled={blocked} onClick={() => start([t.key])}>
                      {done ? "Rever" : "Ver"}
                    </Button>
                  </li>
                )
              })}
            </ul>
            {doneCount > 0 && (
              <button
                type="button"
                onClick={() => void resetProgress()}
                className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Reiniciar o progresso dos tutoriais
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
