"use client"

import { useSyncExternalStore } from "react"
import {
  PROJECT_LOCAL_META_EVENT,
  loadProjectLocalMeta,
  type ProjectLocalMeta,
} from "@/lib/project-local-meta"

const EMPTY_META: ProjectLocalMeta = {}

const cache = new Map<string, { raw: string | null; meta: ProjectLocalMeta }>()

function subscribe(onStoreChange: () => void) {
  window.addEventListener(PROJECT_LOCAL_META_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(PROJECT_LOCAL_META_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

function readCached(projectId: string | null): ProjectLocalMeta {
  if (!projectId || typeof window === "undefined") return EMPTY_META

  const raw = localStorage.getItem(`flowbot:project-meta:${projectId}`)
  const cached = cache.get(projectId)
  if (cached && cached.raw === raw) return cached.meta

  const meta = raw ? loadProjectLocalMeta(projectId) : EMPTY_META
  cache.set(projectId, { raw, meta })
  return meta
}

export function useProjectLocalMeta(projectId: string | null) {
  return useSyncExternalStore(
    subscribe,
    () => readCached(projectId),
    () => EMPTY_META
  )
}
