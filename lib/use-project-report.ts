"use client"

import { useEffect, useState } from "react"
import type { ProjectReport, ReportType } from "@/lib/report"

export interface ReportQuery {
  type: ReportType
  from: string
  to: string
}

export function reportQueryString(q: ReportQuery, extra?: Record<string, string>) {
  const params = new URLSearchParams({ type: q.type })
  if (q.from) params.set("from", q.from)
  if (q.to) params.set("to", q.to)
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v)
  return params.toString()
}

// Carrega o relatório consolidado do projeto para os parâmetros informados.
export function useProjectReport(projectId: string, query: ReportQuery) {
  const [report, setReport] = useState<ProjectReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const qs = reportQueryString(query)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}/report?${qs}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao gerar relatório")
        if (cancelled) return
        setReport(data.report)
        setError(null)
      } catch (err) {
        console.error(err)
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao gerar relatório.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [projectId, qs])

  return { report, error, isLoading }
}
