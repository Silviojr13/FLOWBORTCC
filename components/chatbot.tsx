"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { WelcomeScreen } from "@/components/welcome-screen";
import { ChatInput } from "@/components/chat-input";
import { ProjectCreationLayout } from "@/components/project-steps/project-creation-layout";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { BotIcon, SaveIcon, UserIcon } from "lucide-react";
import {
  messageHasGeneratedRequirements,
  parseRequirementsFromMessage,
} from "@/lib/parse-requirements";

const CHAT_IMPORT_KEY = "flowbot:chat-requirements";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

/* ------------------------------------------------------------------ */
/*  Typing Indicator                                                   */
/* ------------------------------------------------------------------ */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Message Bubble                                                     */
/* ------------------------------------------------------------------ */

function MessageBubble({
  msg,
  onSaveRequirements,
}: {
  msg: Message;
  onSaveRequirements: (content: string) => void;
}) {
  const isUser = msg.role === "user";
  const hasRequirements = !isUser && messageHasGeneratedRequirements(msg.content);

  return (
    <div
      className={`animate-fade-in-up flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${
          isUser
            ? "bg-linear-to-br from-primary to-primary/70 text-primary-foreground"
            : "border border-white/8 bg-white/4 text-muted-foreground"
        }`}
      >
        {isUser ? (
          <UserIcon className="size-3.5" />
        ) : (
          <BotIcon className="size-3.5" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed transition-shadow duration-150 sm:max-w-[75%] ${
          isUser
            ? "rounded-tr-md bg-primary text-primary-foreground hover:shadow-[0_0_16px_-4px_oklch(0.65_0.2_250/30%)]"
            : "rounded-tl-md border border-white/6 bg-white/4 text-foreground hover:border-white/10"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="mt-3 mb-1.5 text-lg font-semibold">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mt-2.5 mb-1 text-base font-semibold">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>
              ),
              p: ({ children }) => <p className="my-1">{children}</p>,
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
              ),
              code: ({ children }) => (
                <code className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-xs">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="my-2 overflow-x-auto rounded-lg bg-white/4 p-3 font-mono text-xs">
                  {children}
                </pre>
              ),
              ul: ({ children }) => (
                <ul className="my-1 list-inside list-disc pl-3">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-1 list-inside list-decimal pl-3">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="my-0.5">{children}</li>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}

        {hasRequirements && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 gap-1.5"
            onClick={() => onSaveRequirements(msg.content)}
          >
            <SaveIcon className="size-3.5" />
            Salvar requisitos em um projeto
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Chat Page                                                     */
/* ------------------------------------------------------------------ */

export default function ChatPage() {
  const router = useRouter();
  const { setOpen } = useSidebar();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState("gemini-2.5-flash");
  const [availableModels, setAvailableModels] = useState<string[]>([
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    if (!trimmed || isStreaming) return;

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
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    // Update title with first message
    if (messages.length === 0 && activeId) {
      const title = trimmed.slice(0, 30) + (trimmed.length > 30 ? "..." : "");
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, title } : c))
      );
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: newMessages, 
          model,
          chatId: currentChatId // Enviar o chatId atual
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = {
            role: "assistant",
            content: `Erro: ${err.error}`,
          };
          return u;
        });
        return;
      }

      // Ler o chatId do header da resposta
      const newChatId = res.headers.get("X-Chat-Id");
      if (newChatId && !currentChatId) {
        setCurrentChatId(newChatId); // Armazenar o novo chatId se não tínhamos um
      }

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
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = {
            role: "assistant",
            content: "Erro ao conectar à API.",
          };
          return u;
        });
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
                  ...newMessages,
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
      const requirements = parseRequirementsFromMessage(content);
      if (requirements.length === 0) return;

      const firstUserMsg = messages.find((m) => m.role === "user")?.content ?? "";
      const projectName =
        firstUserMsg.slice(0, 60).trim() || "Projeto do chat";

      sessionStorage.setItem(
        CHAT_IMPORT_KEY,
        JSON.stringify({ projectName, requirements })
      );
      router.push("/dashboard/projects/new/manual");
    },
    [messages, router]
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  const hasMessages = messages.length > 0;
  const hasStartedChat = messages.some((message) => message.role === "user");

  const chatContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto">
        {hasMessages ? (
          /* ---- Conversation view ---- */
          <div className="mx-auto flex max-w-215 flex-col gap-5 px-4 py-6 sm:py-8 sm:px-6">
            {messages.map((msg, i) => {
              const isStreamingPlaceholder =
                isStreaming &&
                i === messages.length - 1 &&
                msg.role === "assistant" &&
                msg.content === "";

              if (isStreamingPlaceholder) {
                return (
                  <div key={i} className="animate-fade-in-up flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/4 text-muted-foreground">
                      <BotIcon className="size-3.5" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md border border-white/6 bg-white/4 px-4 py-3">
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

  if (!hasStartedChat) {
    return chatContent;
  }

  return (
    <ProjectCreationLayout currentStep="requisitos">
      {chatContent}
    </ProjectCreationLayout>
  );
}