"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import {
  ArrowUpIcon,
  ChevronDownIcon,
  MessageSquarePlusIcon,
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
import {
  executeFlowbotActions,
  parseFlowbotActions,
  type ActionResult,
  type FlowbotAction,
} from "@/lib/flowbot-actions"
import { cn } from "@/lib/utils"

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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
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

  /* ---- mensagens da conversa ativa ---- */

  useEffect(() => {
    if (!activeChatId) return
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
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }]
    setMessages([...nextMessages, { role: "assistant", content: "" }])
    setInput("")
    setIsStreaming(true)
    setAppliedResults(null)
    setDiscardedIndex(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, chatId: activeChatId, projectId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erro ao falar com o assistente")
      }

      const chatId = res.headers.get("X-Chat-Id")
      if (chatId && chatId !== activeChatId) {
        setActiveChatId(chatId)
        // Conversa recém-criada entra na lista sem precisar recarregar tudo.
        setConversations((prev) =>
          prev.some((c) => c.id === chatId)
            ? prev
            : [
                {
                  id: chatId,
                  title: trimmed.slice(0, 60),
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
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, activeChatId, projectId])

  /* ---- render ---- */

  if (!isClient) return null

  return createPortal(
    <>
      {isOpen && (
        <div
          className={cn(
            "animate-fade-in-up fixed bottom-24 right-4 z-50 flex max-h-[min(34rem,calc(100vh-9rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl",
            "left-4 sm:left-auto sm:w-[26rem]"
          )}
          role="dialog"
          aria-label="Assistente FlowBot"
        >
          {/* Cabeçalho */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
            <Image
              src="/images/robo-flowbot.png"
              alt=""
              width={28}
              height={28}
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">FlowBot</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {projectName ?? "Assistente do projeto"}
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="max-w-[9rem] gap-1 px-2 text-xs text-muted-foreground"
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
              className="size-7 shrink-0 text-muted-foreground"
              aria-label="Fechar assistente"
              onClick={() => setIsOpen(false)}
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          {/* Mensagens */}
          <div className="flex min-h-[12rem] flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
            {isLoading && messages.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Carregando conversa...
              </p>
            )}

            {!isLoading && messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                <Image src="/images/robo-flowbot.png" alt="" width={56} height={56} />
                <p className="text-sm font-medium">Como posso ajudar neste projeto?</p>
                <p className="text-xs text-muted-foreground">
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
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                      <Image src="/images/robo-flowbot.png" alt="" width={16} height={16} />
                    </div>
                    <div className="rounded-xl rounded-tl-md border border-border bg-card px-3 py-1.5 shadow-sm">
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
              />
            )}

            <div ref={bottomRef} />
          </div>

          {/* Entrada */}
          <div className="border-t border-border p-2">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-1.5 focus-within:border-primary/40">
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
                placeholder="Pergunte ao FlowBot..."
                rows={1}
                className="max-h-24 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              {isStreaming ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
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
                  className="size-8 shrink-0"
                  aria-label="Enviar mensagem"
                  disabled={!input.trim()}
                  onClick={() => void sendMessage()}
                >
                  <ArrowUpIcon className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Robô flutuante */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Fechar assistente FlowBot" : "Abrir assistente FlowBot"}
        aria-expanded={isOpen}
        className="fixed bottom-6 right-6 z-50 flex size-16 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className={cn(!isOpen && "animate-float-soft")}>
          <Image
            src="/images/robo-flowbot.png"
            alt=""
            width={48}
            height={48}
            className="pointer-events-none select-none"
            priority
          />
        </span>
      </button>
    </>,
    document.body
  )
}
