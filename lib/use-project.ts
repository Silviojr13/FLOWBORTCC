"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { ProjectPermissions } from "./project-permissions"

export interface ProjectDetail {
  id: string
  name: string
  description: string | null
  origin: "manual" | "ia"
  /** Nome de quem criou o projeto (aparece para quem foi convidado). */
  ownerName: string | null
  /** O que a pessoa logada pode fazer neste projeto. */
  access: ProjectPermissions
}

export function useProject(projectId: string) {
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setNotFound(false)

      try {
        const res = await fetch(`/api/projects/${projectId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Projeto não encontrado")
        if (!cancelled) setProject({ ...data.project, access: data.access })
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setNotFound(true)
          toast.error(error instanceof Error ? error.message : "Erro ao carregar projeto.")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [projectId])

  return { project, notFound, isLoading }
}
