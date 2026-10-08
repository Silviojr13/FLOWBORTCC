"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import {
  ArrowUpIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
  MessageSquarePlusIcon,
  MicIcon,
  SquareIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MessageBubble,
  TypingIndicator,
  type ChatMessage,
} from "@/components/chat/message-bubble"
import { FlowbotActionProposal } from "@/components/project/flowbot-action-proposal"
import { AttachButton, AttachmentChip, useAttachmentPicker } from "@/components/chat/attachment-picker"
import { withAttachment } from "@/lib/chat-attachments"
import {
  executeFlowbotActions,
  parseFlowbotActions,
  type ActionResult,
  type FlowbotAction,
} from "@/lib/flowbot-actions"
import { cn } from "@/lib/utils"
import { useVoiceInput } from "@/lib/use-voice-input"

// O <main> do dashboard usa backdrop-filter, o que cria um containing block e faria
// `position: fixed` se ancorar nele (o robô subiria junto com o scroll). Renderizar em um
// portal no <body> mantém o assistente preso à viewport sem mexer no visual do layout.
const emptySubscribe = () => () => {}
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

interface ConversationSummary {
  id: string
  title: string
  date: string
  messageCount: number
}

/**
 * Assistente FlowBot flutuante, presente em todas as abas do projeto.
 * Mostra a conversa que originou o projeto (Modo A) e permite iniciar novas conversas —
 * tudo persistido no banco, satisfazendo a persistência de chat prevista na Sprint 1.
 */
export function FlowbotAssistant({
  projectId,
  projectName,
}: {
  projectId: string
  projectName?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  // Conversa criada pelo próprio envio: já está na tela, não precisa ser recarregada do
  // servidor. Recarregar no meio da resposta trocava a lista pela versão sem a resposta, e o
  // texto seguinte ia parar na bolha da pessoa.
  const ownChatIdRef = useRef<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  // Ditado por voz: o texto falado entra no campo, para a pessoa revisar antes de enviar.
  const voice = useVoiceInput({ text: input, onText: setInput })
  const voiceActive = voice.state === "listening" || voice.state === "recording"
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasLoadedList, setHasLoadedList] = useState(false)

  // Proposta de alterações da última resposta: nada é gravado sem confirmação.
  const [isApplying, setIsApplying] = useState(false)
  const [appliedResults, setAppliedResults] = useState<ActionResult[] | null>(null)
  const [discardedIndex, setDiscardedIndex] = useState<number | null>(null)

  const router = useRouter()

  const isClient = useIsClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const files = useAttachmentPicker(() => textareaRef.current?.focus())
  const attachment = files.attachment
  const clearAttachment = files.clear
  const readingFile = Boolean(files.reading)
  const abortRef = useRef<AbortController | null>(null)

  const activeTitle =
    conversations.find((c) => c.id === activeChatId)?.title ?? "Nova conversa"

  // Só a última mensagem do assistente pode ter proposta pendente.
  const lastIndex = messages.length - 1
  const pendingActions = useMemo<FlowbotAction[]>(() => {
    if (isStreaming || discardedIndex === lastIndex) return []
    const last = messages[lastIndex]
    if (!last || last.role !== "assistant") return []
    return parseFlowbotActions(last.content)
  }, [messages, lastIndex, isStreaming, discardedIndex])

  /* ---- carga das conversas do projeto ---- */

  useEffect(() => {
    if (!isOpen || hasLoadedList) return
    let cancelled = false

    async function loadConversations() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/conversations?projectId=${projectId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao carregar conversas")
        if (cancelled) return

        const list: ConversationSummary[] = data.conversations
        setConversations(list)
        setHasLoadedList(true)
        // Abre na conversa mais recente do projeto (a que o criou, quando é a única).
        if (list.length > 0) setActiveChatId(list[0].id)
      } catch (error) {
        console.error(error)
        if (!cancelled) toast.error("Não foi possível carregar as conversas do projeto.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadConversations()
    return () => {
      cancelled = true
    }
  }, [isOpen, hasLoadedList, projectId])

  const { state: voiceState, toggle: toggleVoice } = voice
  useEffect(() => {
    if (!isOpen && (voiceState === "listening" || voiceState === "recording")) toggleVoice()
  }, [isOpen, voiceState, toggleVoice])

  /* ---- mensagens da conversa ativa ---- */

  useEffect(() => {
    if (!activeChatId) return
    if (ownChatIdRef.current === activeChatId) {
      ownChatIdRef.current = null
      return
    }
    let cancelled = false
    setIsLoading(true)

    resetProposalState()

    fetch(`/api/conversations/${activeChatId}/messages`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao carregar mensagens")
        if (!cancelled) setMessages(data.messages)
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) toast.error("Não foi possível carregar a conversa.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeChatId])

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isOpen])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }, [input])

  /* ---- ações ---- */

  function resetProposalState() {
    setAppliedResults(null)
    setDiscardedIndex(null)
  }

  function startNewConversation() {
    abortRef.current?.abort()
    setIsStreaming(false)
    setActiveChatId(null)
    setMessages([])
    setInput("")
    resetProposalState()
  }

  // Executa as alterações confirmadas e atualiza as telas do projeto.
  async function applyActions(actions: FlowbotAction[]) {
    setIsApplying(true)
    try {
      const results = await executeFlowbotActions(projectId, actions)
      setAppliedResults(results)

      const failed = results.filter((r) => !r.ok)
      if (failed.length === 0) {
        toast.success(
          results.length === 1 ? "Alteração aplicada." : `${results.length} alterações aplicadas.`
        )
      } else {
        toast.warning(`${failed.length} de ${results.length} alteração(ões) falharam.`)
      }

      // Registra o resultado na conversa: vira histórico e impede que a mesma proposta
      // volte a aparecer como pendente depois de recarregar a página.
      const summary = [
        `**Alterações aplicadas** (${results.filter((r) => r.ok).length}/${results.length})`,
        ...results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.message}`),
      ].join("\n")

      if (activeChatId) {
        await fetch(`/api/conversations/${activeChatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: summary }),
        }).catch((error) => console.error(error))
      }
      setMessages((prev) => [...prev, { role: "assistant", content: summary }])
      setAppliedResults(null)

      if (results.some((r) => r.ok)) router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Não foi possível aplicar as alterações.")
    } finally {
      setIsApplying(false)
    }
  }

  const sendMessage = useCallback(async () => {
    const trimmed = withAttachment(input, attachment).trim()
    if (!trimmed || isStreaming || readingFile) return
    if (voiceState === "listening" || voiceState === "recording") toggleVoice()
    // Título da conversa nova: o que a pessoa escreveu ou, só com anexo, o nome do arquivo.
    const titleSource = input.trim() || attachment?.name || trimmed

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }]
    // Avisos e erros da interface não vão para a IA como conversa.
    const history = nextMessages.filter((m) => !m.error && m.content.trim())
    setMessages([...nextMessages, { role: "assistant", content: "" }])
    setInput("")
    clearAttachment()
    setIsStreaming(true)
    setAppliedResults(null)
    setDiscardedIndex(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const setLast = (message: ChatMessage) =>
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = message
          return updated
        })
      let chatIdForRequest = activeChatId
      let res: Response
      // Limite de uso por minuto da IA: espera o tempo pedido e reenvia sozinho (até 2 vezes).
      for (let attempt = 0; ; attempt++) {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, chatId: chatIdForRequest, projectId }),
          signal: controller.signal,
        })
        if (res.status !== 429 || attempt >= 2) break
        const wait = await res.json().catch(() => ({}))
        if (wait.chatId) {
          chatIdForRequest = wait.chatId
          if (wait.chatId !== activeChatId) {
            ownChatIdRef.current = wait.chatId
            setActiveChatId(wait.chatId)
          }
        }
        const seconds = Math.min(Math.max(Math.ceil(Number(wait.retryAfter) || 30), 3), 90)
        for (let left = seconds; left > 0; left--) {
          if (controller.signal.aborted) throw new DOMException("cancelado", "AbortError")
          setLast({
            role: "assistant",
            content: `A IA atingiu o limite de uso por minuto. Tentando de novo em ${left} s…`,
            error: true,
          })
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
        setLast({ role: "assistant", content: "" })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erro ao falar com o assistente")
      }

      const chatId = res.headers.get("X-Chat-Id")
      if (chatId && chatId !== activeChatId) {
        ownChatIdRef.current = chatId
        setActiveChatId(chatId)
        // Conversa recém-criada entra na lista sem precisar recarregar tudo.
        setConversations((prev) =>
          prev.some((c) => c.id === chatId)
            ? prev
            : [
                {
                  id: chatId,
                  title: titleSource.slice(0, 60),
                  date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
                  messageCount: 2,
                },
                ...prev,
              ]
        )
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + chunk }
          return updated
        })
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      console.error(error)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "assistant",
          content: error instanceof Error ? `Erro: ${error.message}` : "Erro ao conectar à API.",
          error: true,
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, attachment, clearAttachment, readingFile, isStreaming, messages, activeChatId, projectId, voiceState, toggleVoice])

  /* ---- render ---- */

  if (!isClient) return null

  return createPortal(
    <>
      {isOpen && (
        <div
          className={cn(
            "animate-fade-in-up fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl dark:shadow-lg",
            "inset-x-4 bottom-[6.75rem] h-[min(44rem,calc(100svh-8.75rem))]",
            "sm:inset-x-auto sm:right-7 sm:bottom-[7.5rem] sm:w-[30rem]"
          )}
          role="dialog"
          aria-label="Assistente FlowBot"
        >
          <div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-3">
            <Image
              src="/images/robo-flowbot.png"
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">FlowBot</p>
              <p className="truncate text-xs text-muted-foreground">
                {projectName ?? "Assistente do projeto"}
              </p>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="hidden size-8 shrink-0 text-muted-foreground sm:inline-flex"
              aria-label="Nova conversa"
              onClick={startNewConversation}
            >
              <MessageSquarePlusIcon className="size-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="max-w-[6.5rem] gap-1 px-2 text-xs text-muted-foreground sm:max-w-[10rem]"
                >
                  <span className="truncate">{activeTitle}</span>
                  <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
                <DropdownMenuItem onClick={startNewConversation}>
                  <MessageSquarePlusIcon className="size-4" />
                  Nova conversa
                </DropdownMenuItem>
                {conversations.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Conversas deste projeto
                    </DropdownMenuLabel>
                    {conversations.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => setActiveChatId(c.id)}
                        className={cn(c.id === activeChatId && "bg-primary/10 text-primary")}
                      >
                        <span className="min-w-0 flex-1 truncate">{c.title}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{c.date}</span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label="Fechar assistente"
              onClick={() => setIsOpen(false)}
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            {isLoading && messages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Carregando conversa...
              </p>
            )}

            {!isLoading && messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
                <Image src="/images/robo-flowbot.png" alt="" width={72} height={72} />
                <p className="text-sm font-medium text-foreground">Como posso ajudar neste projeto?</p>
                <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                  Tire dúvidas técnicas sobre sensores, atuadores e microcontroladores ou peça
                  ajuda para refinar os requisitos.
                </p>
              </div>
            )}

            {messages.map((msg, i) => {
              const isPlaceholder =
                isStreaming &&
                i === messages.length - 1 &&
                msg.role === "assistant" &&
                msg.content === ""

              if (isPlaceholder) {
                return (
                  <div key={i} className="flex gap-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                      <Image src="/images/robo-flowbot.png" alt="" width={18} height={18} />
                    </div>
                    <div className="rounded-xl rounded-tl-md border border-border bg-card px-3 py-2 shadow-sm">
                      <TypingIndicator />
                    </div>
                  </div>
                )
              }

              return <MessageBubble key={i} msg={msg} compact />
            })}

            {(pendingActions.length > 0 || appliedResults) && (
              <FlowbotActionProposal
                actions={pendingActions}
                results={appliedResults}
                isApplying={isApplying}
                onConfirm={applyActions}
                onDiscard={() => setDiscardedIndex(lastIndex)}
                projectId={projectId}
              />
            )}

            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-3">
            <div className="rounded-xl border border-border bg-muted p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
              <AttachmentChip attachment={attachment} reading={files.reading} onRemove={clearAttachment} />
              <div className="flex items-end gap-2">
                {files.input}
                <AttachButton
                  onClick={files.open}
                  disabled={isStreaming}
                  reading={Boolean(files.reading)}
                  className="size-9 shrink-0"
                />
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder={voiceActive ? "Pode falar, estou ouvindo..." : "Pergunte ao FlowBot..."}
                  rows={1}
                  className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {voiceActive && (
                  <span className="flex shrink-0 items-center gap-1 self-center text-xs text-destructive" aria-live="polite">
                    <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
                    {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, "0")}
                  </span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  title={voiceActive ? "Parar de ditar" : "Ditar mensagem"}
                  aria-label={voiceActive ? "Parar de ditar" : "Ditar mensagem"}
                  aria-pressed={voiceActive}
                  disabled={isStreaming || voice.state === "transcribing" || voice.state === "starting"}
                  onClick={voice.toggle}
                  className={cn(
                    "size-9 shrink-0",
                    voiceActive
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {voice.state === "transcribing" || voice.state === "starting" ? (
                    <LoaderCircleIcon className="size-4 animate-spin" />
                  ) : voiceActive ? (
                    <SquareIcon className="size-3.5" />
                  ) : (
                    <MicIcon className="size-4" />
                  )}
                </Button>
                {isStreaming ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 shrink-0"
                    aria-label="Parar resposta"
                    onClick={() => {
                      abortRef.current?.abort()
                      setIsStreaming(false)
                    }}
                  >
                    <SquareIcon className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="size-9 shrink-0"
                    aria-label="Enviar mensagem"
                    disabled={(!input.trim() && !attachment) || voice.state === "transcribing" || Boolean(files.reading)}
                    onClick={() => void sendMessage()}
                  >
                    <ArrowUpIcon className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Fechar assistente FlowBot" : "Abrir assistente FlowBot"}
        aria-expanded={isOpen}
        data-tour="flowbot-assistant"
        className="fixed right-4 bottom-5 z-50 flex size-[4.75rem] items-center justify-center rounded-full border-2 border-primary/40 bg-card shadow-xl ring-4 ring-primary/15 transition-transform duration-200 hover:scale-105 hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none sm:right-7 sm:bottom-7 sm:size-20"
      >
        <span className={cn(!isOpen && "animate-float-soft")}>
          <Image
            src="/images/robo-flowbot.png"
            alt=""
            width={64}
            height={64}
            className="pointer-events-none size-14 select-none object-contain sm:size-16"
            priority
          />
        </span>
      </button>
    </>,
    document.body
  )
}
