"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

/**
 * Ditado por voz para o campo de mensagem.
 * - Primeiro pede o microfone explicitamente: garante o pedido de permissão e descobre se há
 *   microfone (antes, alguns navegadores "começavam a ouvir" sem pedir nada e nunca escreviam).
 * - Chrome e Edge: reconhecimento de voz do próprio navegador, em português, com o texto
 *   aparecendo enquanto a pessoa fala.
 * - Navegadores sem reconhecimento, ou em que ele não responde (Brave, navegadores embutidos):
 *   grava o áudio e transcreve no servidor (/api/transcribe).
 */

export type VoiceState = "idle" | "starting" | "listening" | "recording" | "transcribing"

const MAX_RECORDING_MS = 2 * 60 * 1000
/** Se o reconhecimento não começar a captar áudio neste tempo, ele não funciona aqui. */
const AUDIO_START_TIMEOUT_MS = 4000

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onaudiostart: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const join = (a: string, b: string) => (a.trim() && b.trim() ? `${a.trimEnd()} ${b.trim()}` : `${a}${b}`.trim())

/** Mensagem clara para cada falha ao abrir o microfone. */
function microphoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço do site, permita o microfone e tente de novo."
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Nenhum microfone foi encontrado. Conecte um microfone ou confira o dispositivo de entrada do computador."
  }
  if (name === "NotReadableError") {
    return "O microfone está em uso por outro programa (ou foi desativado no sistema). Feche o outro programa e tente de novo."
  }
  return "Não foi possível usar o microfone neste navegador."
}

export function useVoiceInput({ text, onText }: { text: string; onText: (value: string) => void }) {
  const [state, setState] = useState<VoiceState>("idle")
  const [seconds, setSeconds] = useState(0)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<number | null>(null)
  const baseRef = useRef("")
  const textRef = useRef(text)
  useEffect(() => {
    textRef.current = text
  }, [text])

  const stopTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  const transcribe = useCallback(
    async (blob: Blob) => {
      setState("transcribing")
      try {
        const form = new FormData()
        form.append("audio", blob, "fala.webm")
        const res = await fetch("/api/transcribe", { method: "POST", body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Não foi possível transcrever o áudio.")
        if (data.text) onText(join(baseRef.current, data.text))
        else toast.info("Não deu para entender o áudio. Tente falar mais perto do microfone.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível transcrever o áudio.")
      } finally {
        setState("idle")
      }
    },
    [onText]
  )

  /** Grava o áudio e transcreve no servidor ao parar. */
  const startRecording = useCallback(
    (stream: MediaStream) => {
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      recorder.onstop = () => {
        stopTimer()
        stream.getTracks().forEach((track) => track.stop())
        recorderRef.current = null
        void transcribe(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }))
      }
      recorderRef.current = recorder
      recorder.start()
      setState("recording")
      setSeconds(0)
      const startedAt = Date.now()
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt
        setSeconds(Math.floor(elapsed / 1000))
        if (elapsed >= MAX_RECORDING_MS) recorder.stop()
      }, 500)
    },
    [transcribe]
  )

  const start = useCallback(async () => {
    baseRef.current = textRef.current
    setSeconds(0)

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Este navegador não permite usar o microfone aqui. Use o Google Chrome ou o Microsoft Edge.")
      return
    }

    // 1. Pede o microfone: mostra o pedido de permissão e confirma que existe um microfone.
    setState("starting")
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (error) {
      toast.error(microphoneError(error))
      setState("idle")
      return
    }

    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      startRecording(stream)
      return
    }

    // 2. Reconhecimento do navegador: ele mesmo capta o áudio, então o teste acima é liberado.
    stream.getTracks().forEach((track) => track.stop())
    const recognition = new Recognition()
    recognition.lang = "pt-BR"
    recognition.continuous = true
    recognition.interimResults = true
    let finalText = ""
    let heardAudio = false
    let wroteText = false
    let failed = false

    // Navegadores que têm o reconhecimento mas não o fazem funcionar (Brave, navegadores
    // embutidos) nunca começam a captar: passa para a gravação com transcrição no servidor.
    const watchdog = window.setTimeout(async () => {
      if (heardAudio || recognitionRef.current !== recognition) return
      failed = true
      recognition.abort()
      toast.info("O reconhecimento de voz deste navegador não respondeu. Vou gravar e transcrever no servidor.")
      try {
        startRecording(await navigator.mediaDevices.getUserMedia({ audio: true }))
      } catch (error) {
        toast.error(microphoneError(error))
        setState("idle")
      }
    }, AUDIO_START_TIMEOUT_MS)

    recognition.onaudiostart = () => {
      heardAudio = true
    }
    recognition.onresult = (event) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText = join(finalText, result[0].transcript)
        else interim = join(interim, result[0].transcript)
      }
      const spoken = join(finalText, interim)
      if (spoken) wroteText = true
      onText(join(baseRef.current, spoken))
    }
    recognition.onerror = (event) => {
      if (event.error === "aborted") return
      failed = true
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("O navegador bloqueou o reconhecimento de voz. Permita o microfone no cadeado ao lado do endereço.")
      } else if (event.error === "audio-capture") {
        toast.error("Nenhum microfone captou áudio. Confira o dispositivo de entrada do computador.")
      } else if (event.error === "network") {
        toast.error("O reconhecimento de voz deste navegador está indisponível. Use o Google Chrome ou o Microsoft Edge.")
      } else if (event.error === "no-speech") {
        toast.info("Não ouvi nenhuma fala. Confira se o microfone certo está selecionado e fale mais perto dele.")
      } else {
        toast.error("O reconhecimento de voz parou. Tente de novo.")
      }
    }
    recognition.onend = () => {
      window.clearTimeout(watchdog)
      if (recognitionRef.current === recognition) recognitionRef.current = null
      // Se a gravação reserva assumiu, ela controla o estado a partir daqui.
      if (recorderRef.current) return
      stopTimer()
      setState("idle")
      if (heardAudio && !wroteText && !failed) {
        toast.info("Não captei nenhuma palavra. Confira se o microfone certo está selecionado no navegador.")
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      window.clearTimeout(watchdog)
      recognitionRef.current = null
      setState("idle")
      toast.error("Não foi possível iniciar o reconhecimento de voz. Tente de novo.")
      return
    }
    setState("listening")
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
  }, [onText, startRecording])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    if (recorderRef.current?.state === "recording") recorderRef.current.stop()
  }, [])

  const toggle = useCallback(() => {
    if (state === "listening" || state === "recording") stop()
    else if (state === "idle") void start()
  }, [state, start, stop])

  // Sai da tela no meio da gravação: para tudo.
  useEffect(
    () => () => {
      recognitionRef.current?.abort()
      if (recorderRef.current?.state === "recording") recorderRef.current.stop()
      stopTimer()
    },
    []
  )

  return { state, seconds, toggle }
}
