"use client";

import { Button } from "@/components/ui/button";

interface TopbarProps {
    model: string;
    availableModels: string[];
    onModelChange: (m: string) => void;
    onClear: () => void;
    isStreaming: boolean;
    hasMessages: boolean;
    isDark: boolean;           // adicione
    onToggleTheme: () => void; // adicione
}

export default function Topbar({ model, availableModels, onModelChange, onClear, isStreaming, hasMessages, isDark, onToggleTheme }: TopbarProps) {
    return (
        <header style={{
            height: "52px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            background: "var(--background)",
            flexShrink: 0,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "500", color: "var(--foreground)" }}>
                    Nova conversa
                </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <select
                    value={model}
                    onChange={(e) => onModelChange(e.target.value)}
                    style={{
                        fontSize: "12px",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        cursor: "pointer",
                        fontFamily: "'Space Mono', monospace",
                        outline: "none",
                    }}
                >
                    {availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>

                {/* botão de tema */}
                <button
                    onClick={onToggleTheme}
                    title={isDark ? "Modo claro" : "Modo escuro"}
                    style={{
                        background: "var(--muted)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        padding: "5px 10px",
                        cursor: "pointer",
                        fontSize: "14px",
                        color: "var(--foreground)",
                    }}
                >
                    {isDark ? "☀️" : "🌙"}
                </button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    disabled={isStreaming || !hasMessages}
                    style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                    Limpar
                </Button>
            </div>
        </header>
    );
}