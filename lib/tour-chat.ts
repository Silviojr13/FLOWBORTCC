"use client"

import type { DemoChatSegment } from "./tour-chat-script"

/**
 * Ponte entre o tour guiado e a tela de chat.
 *
 * O tour não conhece o estado interno do chat: ele pede que um trecho da conversa
 * roteirizada seja reproduzido e espera o aviso de conclusão. Como a tela de chat pode
 * ainda estar montando quando o pedido sai (o tour acabou de navegar até ela), o pedido
 * pendente fica guardado e é atendido assim que o chat começar a escutar.
 */

const PLAY_EVENT = "flowbot:tour-chat-play"
const DONE_EVENT = "flowbot:tour-chat-done"
const END_EVENT = "flowbot:tour-chat-end"
const SAVE_EVENT = "flowbot:tour-chat-save"

let pending: DemoChatSegment | null = null

export function requestDemoChat(segment: DemoChatSegment) {
  pending = segment
  window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: segment }))
}

/**
 * Usado pela tela de chat. Atende também um pedido feito antes de ela montar.
 *
 * O pedido pendente só é consumido depois de um ciclo, e só se esta inscrição ainda
 * estiver ativa: no Strict Mode o React monta, desmonta e monta de novo — se a primeira
 * montagem (descartada) consumisse o pedido, a segunda nunca reproduziria a conversa.
 */
export function onDemoChatRequest(callback: (segment: DemoChatSegment) => void) {
  let active = true

  const handler = (e: Event) => {
    pending = null
    callback((e as CustomEvent<DemoChatSegment>).detail)
  }
  window.addEventListener(PLAY_EVENT, handler)

  const timer = window.setTimeout(() => {
    if (!active || !pending) return
    const segment = pending
    pending = null
    callback(segment)
  }, 0)

  return () => {
    active = false
    window.clearTimeout(timer)
    window.removeEventListener(PLAY_EVENT, handler)
  }
}

export function notifyDemoChatDone(segment: DemoChatSegment) {
  window.dispatchEvent(new CustomEvent(DONE_EVENT, { detail: segment }))
}

export function onDemoChatDone(callback: (segment: DemoChatSegment) => void) {
  const handler = (e: Event) => callback((e as CustomEvent<DemoChatSegment>).detail)
  window.addEventListener(DONE_EVENT, handler)
  return () => window.removeEventListener(DONE_EVENT, handler)
}

/** O tour terminou ou foi pulado: o chat descarta a conversa de demonstração. */
export function endDemoChat() {
  pending = null
  window.dispatchEvent(new CustomEvent(END_EVENT))
}

export function onDemoChatEnd(callback: () => void) {
  window.addEventListener(END_EVENT, callback)
  return () => window.removeEventListener(END_EVENT, callback)
}

/** Clique em "Salvar requisitos" durante a demonstração: quem decide o próximo passo é o tour. */
export function notifyDemoSave() {
  window.dispatchEvent(new CustomEvent(SAVE_EVENT))
}

export function onDemoSave(callback: () => void) {
  window.addEventListener(SAVE_EVENT, callback)
  return () => window.removeEventListener(SAVE_EVENT, callback)
}
