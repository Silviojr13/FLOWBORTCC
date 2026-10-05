"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

/**
 * Ditado por voz para o campo de mensagem.
 * - Chrome e Edge: reconhecimento de voz do próprio navegador, em português, com o texto
 *   aparecendo enquanto a pessoa fala.
 * - Demais navegadores: grava o áudio e transcreve no servidor (/api/transcribe).
 */

export type VoiceState = "idle" | "listening" | "recording" | "transcribing"

const MAX_RECORDING_MS = 2 * 60 * 1000

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
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

  const start = useCallback(async () => {
    baseRef.current = textRef.current
    setSeconds(0)

    const Recognition = getSpeechRecognition()
    if (!Recognition && (typeof MediaRecorder === "undefined" || !navigator.mediaDevices)) {
      toast.error("Este navegador não permite ditar mensagens. Use o Chrome ou o Edge.")
      return
    }
    if (Recognition) {
      const recognition = new Recognition()
      recognition.lang = "pt-BR"
      recognition.continuous = true
      recognition.interimResults = true
      let finalText = ""
      recognition.onresult = (event) => {
        let interim = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) finalText = join(finalText, result[0].transcript)
          else interim = join(interim, result[0].transcript)
        }
        onText(join(baseRef.current, join(finalText, interim)))
      }
      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          toast.error("Permita o uso do microfone no navegador para ditar a mensagem.")
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
          toast.error("O reconhecimento de voz parou. Tente de novo.")
        }
      }
      recognition.onend = () => {
        stopTimer()
        recognitionRef.current = null
        setState("idle")
      }
      recognitionRef.current = recognition
      recognition.start()
      setState("listening")
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
      const startedAt = Date.now()
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt
        setSeconds(Math.floor(elapsed / 1000))
        if (elapsed >= MAX_RECORDING_MS) recorder.stop()
      }, 500)
    } catch {
      toast.error("Não foi possível usar o microfone. Verifique a permissão do navegador.")
      setState("idle")
    }
  }, [onText, transcribe])

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
      recognitionRef.current?.stop()
      if (recorderRef.current?.state === "recording") recorderRef.current.stop()
      stopTimer()
    },
    []
  )

  return { state, seconds, toggle }
}
