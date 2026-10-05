"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "@/components/welcome-screen";
import { ChatInput } from "@/components/chat-input";
import { ProjectCreationLayout } from "@/components/project-steps/project-creation-layout";
import { useSidebar } from "@/components/ui/sidebar";
import { BotIcon, SquarePenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MessageBubble,
  TypingIndicator,
  type ChatMessage as Message,
} from "@/components/chat/message-bubble";
import { parseRequirementsFromMessage } from "@/lib/parse-requirements";
import { DEMO_CHAT } from "@/lib/tour-chat-script";
import {
  notifyDemoChatDone,
  notifyDemoSave,
  onDemoChatEnd,
  onDemoChatRequest,
} from "@/lib/tour-chat";

const CHAT_IMPORT_KEY = "flowbot:chat-requirements";
// Conversa em andamento (antes de virar projeto): recarregar a página a reabre.
const CURRENT_CHAT_KEY = "flowbot:conversa-em-andamento";

function readSavedChat(): string | null {
  try {
    return localStorage.getItem(CURRENT_CHAT_KEY);
  } catch {
    return null;
  }
}

function saveCurrentChat(chatId: string) {
  try {
    localStorage.setItem(CURRENT_CHAT_KEY, chatId);
  } catch {
    /* sem armazenamento: a conversa continua no histórico do servidor */
  }
}

function clearSavedChat() {
  try {
    localStorage.removeItem(CURRENT_CHAT_KEY);
  } catch {
    /* nada a limpar */
  }
}

/** Espera `seconds`, avisando a cada segundo; para se o envio for cancelado. */
async function countdown(seconds: number, onTick: (left: number) => void, signal: AbortSignal) {
  for (let left = seconds; left > 0; left--) {
    if (signal.aborted) throw new DOMException("cancelado", "AbortError");
    onTick(left);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (signal.aborted) throw new DOMException("cancelado", "AbortError");
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Conversation {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

/* ------------------------------------------------------------------ */
/*  Main Chat Page                                                     */
/* ------------------------------------------------------------------ */

export default function ChatPage({ fresh = false }: { fresh?: boolean }) {
  const router = useRouter();
  const { setOpen } = useSidebar();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState("qwen/qwen3.8-27b");
  const [availableModels, setAvailableModels] = useState<string[]>([
    "qwen/qwen3.8-27b",
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Demonstração do tour guiado: enquanto ativa, a conversa é roteirizada e nada é enviado
  // à IA nem gravado no banco.
  const isDemoRef = useRef(false);
  // Trechos já reproduzidos: um pedido repetido (Strict Mode, clique duplo) é ignorado.
  const playedRef = useRef(new Set<string>());

  /* Tour guiado: reproduz trechos da conversa roteirizada */
  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

    const stopRequest = onDemoChatRequest(async (segment) => {
      if (playedRef.current.has(segment)) return;
      playedRef.current.add(segment);
      isDemoRef.current = true;

      for (const message of DEMO_CHAT[segment]) {
        if (cancelled) return;

        if (message.role === "user") {
          // Digita na caixa de mensagem, como se fosse o usuário.
          for (let i = 1; i <= message.content.length; i += 2) {
            if (cancelled) return;
            setInput(message.content.slice(0, i));
            await sleep(22);
          }
          setInput(message.content);
          await sleep(350);
          setInput("");
          setMessages((prev) => [...prev, message]);
        } else {
          // "Pensando" e depois a resposta chega em partes, como no streaming real.
          setIsStreaming(true);
          setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
          await sleep(900);
          for (let i = 0; i < message.content.length; i += 6) {
            if (cancelled) return;
            const partial = message.content.slice(0, i + 6);
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content: partial };
              return updated;
            });
            await sleep(14);
          }
          setIsStreaming(false);
        }
        await sleep(400);
      }

      if (!cancelled) notifyDemoChatDone(segment);
    });

    const stopEnd = onDemoChatEnd(() => {
      if (!isDemoRef.current) return;
      isDemoRef.current = false;
      playedRef.current.clear();
      setMessages([]);
      setInput("");
      setIsStreaming(false);
    });

    return () => {
      cancelled = true;
      stopRequest();
      stopEnd();
    };
  }, []);

  /* Conversa em andamento: reabre depois de recarregar a página */
  useEffect(() => {
    if (fresh) {
      clearSavedChat();
      return;
    }
    const saved = readSavedChat();
    if (!saved) return;
    let cancelled = false;
    fetch(`/api/conversations/${encodeURIComponent(saved)}/messages`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { messages?: Message[] } | null) => {
        if (cancelled || isDemoRef.current) return;
        const restored = (data?.messages ?? []).filter((m) => m.content?.trim());
        if (restored.length === 0) {
          clearSavedChat();
          return;
        }
        setMessages(restored);
        setCurrentChatId(saved);
        setActiveId(saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fresh]);

  /* Auto-scroll on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Fetch available models */
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models.length > 0) {
          setAvailableModels(data.models);
          setModel(data.models[0]);
        }
      })
      .catch(() => {});
  }, []);

  /* Create new conversation */
  const createNewConversation = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setInput("");
    const id = crypto.randomUUID();
    const now = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
    const newConv: Conversation = {
      id,
      title: "Nova conversa",
      date: now,
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(id);
    setCurrentChatId(null);
    setMessages([]);
    clearSavedChat();
  }, []);

  /* Select conversation */
  const selectConversation = useCallback(
    (id: string) => {
      if (activeId && messages.length > 0) {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, messages } : c))
        );
      }
      const conv = conversations.find((c) => c.id === id);
      if (conv) {
        setActiveId(id);
        setMessages(conv.messages);
      }
    },
    [activeId, messages, conversations]
  );

  /* Send message */
  const sendMessage = useCallback(async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || isStreaming || isDemoRef.current) return;

    // Close sidebar on send for a cleaner chat experience
    setOpen(false);

    if (!activeId) {
      const id = crypto.randomUUID();
      const now = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });
      const title = trimmed.slice(0, 30) + (trimmed.length > 30 ? "..." : "");
      setConversations((prev) => [{ id, title, date: now, messages: [] }, ...prev]);
      setActiveId(id);
      setCurrentChatId(null); // Definir como null pois o backend irá gerar um novo ID
    }

    const userMsg: Message = { role: "user", content: trimmed };
    // Avisos e erros da interface ficam na tela, mas não vão para a IA como conversa.
    const history = [...messages.filter((m) => !m.error && m.content.trim()), userMsg];
    setMessages([...messages, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    // Update title with first message
    if (messages.length === 0 && activeId) {
      const title = trimmed.slice(0, 30) + (trimmed.length > 30 ? "..." : "");
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, title } : c))
      );
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const setLast = (message: Message) =>
      setMessages((prev) => {
        const u = [...prev];
        u[u.length - 1] = message;
        return u;
      });
    let chatIdForRequest = currentChatId;
    const rememberChat = (id: string | null) => {
      if (!id) return;
      chatIdForRequest = id;
      setCurrentChatId(id);
      saveCurrentChat(id);
    };

    try {
      let res: Response;
      // Limite de uso por minuto da IA: espera o tempo pedido e reenvia sozinho (até 2 vezes).
      for (let attempt = 0; ; attempt++) {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, model, chatId: chatIdForRequest }),
          signal: controller.signal,
        });
        if (res.status !== 429 || attempt >= 2) break;
        const wait = await res.json().catch(() => ({}));
        rememberChat(wait.chatId ?? null);
        const seconds = Math.min(Math.max(Math.ceil(Number(wait.retryAfter) || 30), 3), 90);
        await countdown(
          seconds,
          (left) =>
            setLast({
              role: "assistant",
              content: `A IA atingiu o limite de uso por minuto do plano gratuito. Tentando de novo em ${left} s…`,
              error: true,
            }),
          controller.signal
        );
        setLast({ role: "assistant", content: "" });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        rememberChat(err.chatId ?? null);
        setLast({ role: "assistant", content: `Erro: ${err.error ?? "a IA não respondeu."}`, error: true });
        return;
      }

      // Ler o chatId do header da resposta
      rememberChat(res.headers.get("X-Chat-Id"));

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = {
            role: "assistant",
            content: u[u.length - 1].content + chunk,
          };
          return u;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setLast({ role: "assistant", content: "Envio cancelado.", error: true });
      } else {
        setLast({ role: "assistant", content: "Erro ao conectar à API.", error: true });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      // Save conversation
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages: [
                  ...history,
                  { role: "assistant" as const, content: "" },
                ],
              }
            : c
        )
      );
    }
  }, [input, isStreaming, messages, model, activeId, currentChatId, setOpen]);

  /* Save requirements generated in Modo A into a new project */
  const handleSaveRequirements = useCallback(
    (content: string) => {
      // Na demonstração, salvar é um passo do tour (que cria o projeto de exemplo).
      if (isDemoRef.current) {
        notifyDemoSave();
        return;
      }

      const requirements = parseRequirementsFromMessage(content);
      if (requirements.length === 0) return;

      const firstUserMsg = messages.find((m) => m.role === "user")?.content ?? "";
      const projectName =
        firstUserMsg.slice(0, 60).trim() || "Projeto do chat";

      sessionStorage.setItem(
        CHAT_IMPORT_KEY,
        JSON.stringify({ projectName, requirements, chatId: currentChatId })
      );
      clearSavedChat();
      router.push("/dashboard/projects/new/manual");
    },
    [messages, router, currentChatId]
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  const hasMessages = messages.length > 0;

  const chatContent = (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto">
        {hasMessages ? (
          /* ---- Conversation view ---- */
          <div className="flex w-full flex-col gap-5 py-6 sm:py-8">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                disabled={isStreaming}
                onClick={() => {
                  if (window.confirm("Começar uma nova conversa? Esta continua no seu histórico.")) {
                    createNewConversation();
                  }
                }}
              >
                <SquarePenIcon className="size-4" />
                Nova conversa
              </Button>
            </div>
            {messages.map((msg, i) => {
              const isStreamingPlaceholder =
                isStreaming &&
                i === messages.length - 1 &&
                msg.role === "assistant" &&
                msg.content === "";

              if (isStreamingPlaceholder) {
                return (
                  <div key={i} className="animate-fade-in-up flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                      <BotIcon className="size-3.5" />
                    </div>
                    <div className="rounded-xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
                      <TypingIndicator />
                    </div>
                  </div>
                );
              }

              return (
                <MessageBubble
                  key={i}
                  msg={msg}
                  onSaveRequirements={handleSaveRequirements}
                />
              );
            })}

            <div ref={bottomRef} />
          </div>
        ) : (
          /* ---- Welcome screen ---- */
          <WelcomeScreen onSuggestionClick={(text) => sendMessage(text)} />
        )}
      </div>

      {/* Sticky input */}
      <ChatInput
        embedded
        input={input}
        onInputChange={setInput}
        onSend={sendMessage}
        isStreaming={isStreaming}
        onStop={() => {
          abortRef.current?.abort();
          setIsStreaming(false);
        }}
      />
    </div>
  );

  return (
    <ProjectCreationLayout>
      {chatContent}
    </ProjectCreationLayout>
  );
}