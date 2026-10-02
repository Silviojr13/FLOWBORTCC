"use client"

import { useEffect, useSyncExternalStore } from "react"
import type { StudyMe, StudyTaskKey } from "./study"

/**
 * Estado da avaliação de usabilidade para o usuário logado, compartilhado entre o painel do
 * participante e o menu da conta (que mostra "Avaliações" ao admin). Uma busca serve aos dois.
 */

const INVITE_KEY = "flowbot:convite-avaliacao"

type Snapshot = { data: StudyMe | null; loading: boolean }

let snapshot: Snapshot = { data: null, loading: true }
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(next: Snapshot) {
  snapshot = next
  listeners.forEach((l) => l())
}

export function readPendingInvite(): string | null {
  try {
    return localStorage.getItem(INVITE_KEY)
  } catch {
    return null
  }
}

export function savePendingInvite(code: string) {
  try {
    localStorage.setItem(INVITE_KEY, code)
  } catch {
    /* armazenamento indisponível: o convite pode ser aberto de novo pelo link */
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(INVITE_KEY)
  } catch {
    /* nada a limpar */
  }
}

export function refreshStudyMe(): Promise<void> {
  if (inflight) return inflight
  const invite = readPendingInvite()
  const qs = invite ? `?invite=${encodeURIComponent(invite)}` : ""
  inflight = fetch(`/api/studies/me${qs}`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((data: StudyMe) => {
      // Convite que não vale mais (encerrado, inexistente ou já aceito) sai do navegador.
      if (invite && !data.invite) clearPendingInvite()
      emit({ data, loading: false })
    })
    // Falha passageira (rede, servidor reiniciando): mantém o último estado conhecido, para o
    // guia não sumir da tela no meio da avaliação.
    .catch(() => emit({ ...snapshot, loading: false }))
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Atualiza o estado com a resposta de uma ação (aceite, marcação, questionário). */
export function setStudyMe(data: StudyMe) {
  emit({ data, loading: false })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const serverSnapshot: Snapshot = { data: null, loading: true }

export function useStudyMe() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot)
  useEffect(() => {
    if (state.loading && !inflight) void refreshStudyMe()
  }, [state.loading])
  return state
}

/**
 * Avisa que o usuário concluiu uma tarefa que só a tela conhece (ex.: o PDF, gerado no
 * navegador). Sem participação ativa a API ignora o aviso; falhas também são ignoradas.
 */
export function markStudyTaskDone(taskKey: StudyTaskKey) {
  fetch("/api/studies/me/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskKey, done: true, auto: true }),
  })
    .then(() => refreshStudyMe())
    .catch(() => {})
}
