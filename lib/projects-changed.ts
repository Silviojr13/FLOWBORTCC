"use client"

// Aviso de que a lista de projetos mudou (ex.: um projeto foi excluído). A barra lateral,
// que carrega os projetos uma vez, escuta para recarregar.
const EVENT = "flowbot:projetos-alterados"

export function notifyProjectsChanged() {
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function onProjectsChanged(callback: () => void) {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}
