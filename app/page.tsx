"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
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
    <div className="msg-enter" style={{ display: "flex", gap: "12px", flexDirection: isUser ? "row-reverse" : "row" }}>
      <div style={{ flexShrink: 0, width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", background: isUser ? "linear-gradient(135deg, #7c6af7, #a78bfa)" : "linear-gradient(135deg, #1a1a1e, #2a2a30)", border: isUser ? "none" : "1px solid var(--border)", color: isUser ? "#fff" : "var(--accent2)", fontFamily: "'Space Mono', monospace" }}>
        {isUser ? "EU" : "G4"}
      </div>
      <div style={{ maxWidth: "75%", padding: "12px 16px", fontSize: "14px", lineHeight: "1.6", background: isUser ? "var(--user-bubble)" : "var(--ai-bubble)", border: isUser ? "1px solid rgba(124,106,247,0.3)" : "1px solid var(--border)", borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px", color: "var(--text)", wordBreak: "break-word" }}>
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
        ) : (
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 style={{ fontSize: "18px", fontWeight: "700", margin: "12px 0 6px" }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "10px 0 6px" }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "8px 0 4px" }}>{children}</h3>,
              p: ({ children }) => <p style={{ margin: "4px 0" }}>{children}</p>,
              strong: ({ children }) => <strong style={{ fontWeight: "700", color: "var(--accent2)" }}>{children}</strong>,
              em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
              code: ({ children }) => (
                <code style={{ background: "rgba(124,106,247,0.15)", padding: "2px 6px", borderRadius: "4px", fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", overflowX: "auto", margin: "8px 0", fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>
                  {children}
                </pre>
              ),
              ul: ({ children }) => <ul style={{ paddingLeft: "20px", margin: "4px 0" }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: "20px", margin: "4px 0" }}>{children}</ol>,
              li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
              blockquote: ({ children }) => (
                <blockquote style={{ borderLeft: "3px solid var(--accent)", paddingLeft: "12px", margin: "8px 0", color: "var(--text-muted)", fontStyle: "italic" }}>
                  {children}
                </blockquote>
              ),
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState("gemma4:12b");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [showModels, setShowModels] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(data => {
      setOllamaConnected(data.connected);
      if (data.models.length > 0) { setAvailableModels(data.models); setModel(data.models[0]); }
    }).catch(() => setOllamaConnected(false));
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    const userMsg: Message = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMessages, model }), signal: controller.signal });
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
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: u[u.length - 1].content + chunk }; return u; });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: "Não foi possível conectar ao Ollama. Certifique-se de que ele está rodando." }; return u; });
      }
    } finally { setIsStreaming(false); abortRef.current = null; }
  }, [input, isStreaming, messages, model]);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(20,20,22,0.9)", backdropFilter: "blur(12px)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #7c6af7, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: "#fff", fontFamily: "'Space Mono', monospace" }}>G</div>
          <div>
            <h1 style={{ fontSize: "15px", fontWeight: "700" }}><span className="gradient-text">Gemma Chat</span></h1>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Space Mono', monospace" }}>powered by Ollama</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", color: ollamaConnected === null ? "var(--text-muted)" : ollamaConnected ? "var(--green)" : "var(--red)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: ollamaConnected === null ? "var(--text-muted)" : ollamaConnected ? "var(--green)" : "var(--red)" }} />
            {ollamaConnected === null ? "verificando..." : ollamaConnected ? "conectado" : "offline"}
          </div>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowModels(!showModels)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 10px", color: "var(--text)", fontSize: "11px", cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
              {model} ▾
            </button>
            {showModels && availableModels.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", zIndex: 50, minWidth: "160px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                {availableModels.map(m => (
                  <button key={m} onClick={() => { setModel(m); setShowModels(false); }} style={{ display: "block", width: "100%", padding: "8px 14px", background: m === model ? "var(--accent-glow)" : "transparent", border: "none", color: m === model ? "var(--accent2)" : "var(--text)", fontSize: "12px", cursor: "pointer", textAlign: "left", fontFamily: "'Space Mono', monospace" }}>{m}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { if (!isStreaming) setMessages([]); }} disabled={isStreaming || messages.length === 0} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 8px", color: "var(--text-muted)", cursor: messages.length === 0 ? "not-allowed" : "pointer", opacity: messages.length === 0 ? 0.4 : 1 }}>⌫</button>
        </div>
      </header>

      {/* Messages */}
      <main style={{ flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "820px", width: "100%", margin: "0 auto" }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", color: "var(--text-muted)", textAlign: "center", padding: "60px 20px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "linear-gradient(135deg, rgba(124,106,247,0.2), rgba(167,139,250,0.1))", border: "1px solid rgba(124,106,247,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>✦</div>
            <div>
              <p style={{ fontSize: "16px", fontWeight: "600", color: "var(--text)", marginBottom: "6px" }}>Como posso ajudar?</p>
              <p style={{ fontSize: "13px", lineHeight: 1.6 }}>Rodando localmente via Ollama. Sua conversa é 100% privada.</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              {["Explique Scrum em 3 pontos", "Como funciona um diagrama UML?", "Exemplo de user story"].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "20px", padding: "7px 14px", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {isStreaming && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0 0 44px" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Space Mono', monospace" }}>
              gemma está gerando...
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "14px 20px 18px", background: "rgba(14,14,15,0.9)", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto", display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <div className="glow-border" style={{ flex: 1, borderRadius: "14px", background: "var(--surface2)", display: "flex", alignItems: "flex-end", padding: "10px 14px" }}>
            <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Digite sua mensagem... (Enter para enviar)" rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: "var(--text)", fontSize: "14px", lineHeight: "1.5", fontFamily: "'Syne', sans-serif", maxHeight: "160px", overflowY: "auto" }} />
          </div>
          {isStreaming ? (
            <button onClick={() => { abortRef.current?.abort(); setIsStreaming(false); }} style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "var(--red)", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>◼</button>
          ) : (
            <button onClick={sendMessage} disabled={!input.trim()} style={{ width: "44px", height: "44px", borderRadius: "12px", background: input.trim() ? "linear-gradient(135deg, #7c6af7, #a78bfa)" : "var(--surface2)", border: "none", color: input.trim() ? "#fff" : "var(--text-muted)", fontSize: "18px", cursor: input.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>↑</button>
          )}
        </div>
        <p style={{ textAlign: "center", fontSize: "10px", color: "var(--text-muted)", marginTop: "8px", fontFamily: "'Space Mono', monospace" }}>Modelo local · Dados não saem do seu computador</p>
      </div>
    </div>
  );
}