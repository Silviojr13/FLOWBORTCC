"use client"

// Código do convite de projeto aberto antes do login: a lista de projetos o encontra quando a
// pessoa entrar (ou terminar o cadastro) e oferece aceitar.
const KEY = "flowbot:convite-projeto"

export function readPendingProjectInvite(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function savePendingProjectInvite(code: string) {
  try {
    localStorage.setItem(KEY, code)
  } catch {
    /* armazenamento indisponível: o convite pode ser aberto de novo pelo link */
  }
}

export function clearPendingProjectInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nada a limpar */
  }
}
