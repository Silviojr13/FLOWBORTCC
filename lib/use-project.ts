"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

export interface ProjectDetail {
  id: string
  name: string
  description: string | null
  origin: "manual" | "ia"
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
        if (!cancelled) setProject(data.project)
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

    load()

    return () => {
      cancelled = true
    }
  }, [projectId])

  return { project, notFound, isLoading }
}
