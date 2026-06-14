"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";


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

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center", padding: "8px 4px" }}>
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className="msg-enter" style={{ display: "flex", gap: "10px", flexDirection: isUser ? "row-reverse" : "row" }}>
      <div style={{
        flexShrink: 0, width: "30px", height: "30px", borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "10px", fontWeight: "700",
        background: isUser ? "linear-gradient(135deg, #7c6af7, #a78bfa)" : "var(--muted)",
        border: isUser ? "none" : "1px solid var(--border)",
        color: isUser ? "#fff" : "var(--muted-foreground)",
        fontFamily: "'Space Mono', monospace",
      }}>
        {isUser ? "EU" : "G4"}
      </div>
      <div style={{
        maxWidth: "72%", padding: "10px 14px", fontSize: "14px", lineHeight: "1.65",
        background: isUser ? "#7c6af7" : "var(--muted)",
        borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
        color: isUser ? "#fff" : "var(--foreground)",
        wordBreak: "break-word",
      }}>
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
        ) : (
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 style={{ fontSize: "17px", fontWeight: "600", margin: "10px 0 6px" }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ fontSize: "15px", fontWeight: "600", margin: "8px 0 4px" }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ fontSize: "14px", fontWeight: "600", margin: "6px 0 4px" }}>{children}</h3>,
              p: ({ children }) => <p style={{ margin: "4px 0" }}>{children}</p>,
              strong: ({ children }) => <strong style={{ fontWeight: "600" }}>{children}</strong>,
              code: ({ children }) => (
                <code style={{ background: "rgba(0,0,0,0.08)", padding: "2px 5px", borderRadius: "4px", fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre style={{ background: "rgba(0,0,0,0.06)", padding: "10px", borderRadius: "6px", overflowX: "auto", margin: "6px 0", fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>
                  {children}
                </pre>
              ),
              ul: ({ children }) => <ul style={{ paddingLeft: "18px", margin: "4px 0" }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: "18px", margin: "4px 0" }}>{children}</ol>,
              li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState("gemma-4-31b-it");
  const [availableModels, setAvailableModels] = useState<string[]>(["gemma-4-31b-it", "gemma-4-26b-a4b-it"]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(data => {
      if (data.models.length > 0) {
        setAvailableModels(data.models);
        setModel(data.models[0]);
      }
    }).catch(() => { });
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const createNewConversation = useCallback(() => {
    const id = crypto.randomUUID();
    const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    const newConv: Conversation = { id, title: "Nova conversa", date: now, messages: [] };
    setConversations(prev => [newConv, ...prev]);
    setActiveId(id);
    setMessages([]);
  }, []);

  const selectConversation = useCallback((id: string) => {
    if (activeId && messages.length > 0) {
      setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages } : c));
    }
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveId(id);
      setMessages(conv.messages);
    }
  }, [activeId, messages, conversations]);

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    if (!activeId) {
      const id = crypto.randomUUID();
      const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      const title = trimmed.slice(0, 30) + (trimmed.length > 30 ? "..." : "");
      setConversations(prev => [{ id, title, date: now, messages: [] }, ...prev]);
      setActiveId(id);
    }

    const userMsg: Message = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    // Atualiza título com primeira mensagem
    if (messages.length === 0 && activeId) {
      const title = trimmed.slice(0, 30) + (trimmed.length > 30 ? "..." : "");
      setConversations(prev => prev.map(c => c.id === activeId ? { ...c, title } : c));
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, model }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: `Erro: ${err.error}` }; return u; });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const u = [...prev];
          u[u.length - 1] = { role: "assistant", content: u[u.length - 1].content + chunk };
          return u;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: "Erro ao conectar à API." }; return u; });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      // Salva conversa
      setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...newMessages, { role: "assistant" as const, content: "" }] } : c));
    }
  }, [input, isStreaming, messages, model, activeId]);

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "var(--background)" }}>


      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>


        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          <main style={{
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxWidth: "100%",
            width: "100%",
            margin: "0 auto"
          }}>
            <main style={{ flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "80%", width: "100%", margin: "0 auto" }}>
              {messages.length === 0 && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--muted-foreground)", textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, rgba(124,106,247,0.15), rgba(167,139,250,0.1))", border: "1px solid rgba(124,106,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>✦</div>
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: "500", color: "var(--foreground)", marginBottom: "4px" }}>Como posso ajudar?</p>
                    <p style={{ fontSize: "13px" }}>Usando {model}</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
                    {["Explique Scrum em 3 pontos", "Como funciona um diagrama UML?", "Exemplo de user story"].map(s => (
                      <button key={s} onClick={() => setInput(s)} style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: "20px", padding: "6px 14px", color: "var(--muted-foreground)", fontSize: "12px", cursor: "pointer" }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

              {isStreaming && messages[messages.length - 1]?.content === "" && (
                <div style={{ paddingLeft: "40px" }}><TypingIndicator /></div>
              )}
              <div ref={bottomRef} />
            </main>
          </main>
        </div>

        {/* Input */}
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 20px 16px", color: "var(--foreground)" }}>
          <div style={{ maxWidth: "80%", margin: "0 auto", display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <div style={{ flex: 1, borderRadius: "12px", border: "1px solid var(--border)", background: "var(--background)", display: "flex", alignItems: "flex-end", padding: "8px 12px", transition: "border-color 0.15s" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7c6af7")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Digite sua mensagem..."
                rows={1}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: "var(--foreground)", fontSize: "14px", lineHeight: "1.5", fontFamily: "'Geist', sans-serif", maxHeight: "140px", overflowY: "auto" }}
              />
            </div>

            {isStreaming ? (
              <Button variant="destructive" size="icon" onClick={() => { abortRef.current?.abort(); setIsStreaming(false); }} style={{ width: "40px", height: "40px", borderRadius: "10px" }}>
                ◼
              </Button>
            ) : (
              <Button size="icon" onClick={sendMessage} disabled={!input.trim()} style={{ width: "40px", height: "40px", borderRadius: "10px", background: input.trim() ? "#7c6af7" : "var(--muted)", border: "none" }}>
                ↑
              </Button>
            )}
          </div>
          <p style={{ textAlign: "center", fontSize: "11px", color: "var(--muted-foreground)", marginTop: "6px", fontFamily: "'Space Mono', monospace" }}>
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </div>
  );
}
