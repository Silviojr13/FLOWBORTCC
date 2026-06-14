"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Conversation {
  id: string;
  title: string;
  date: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ conversations, activeId, onSelect, onNew, collapsed, onToggle }: SidebarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        style={{
          width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)",
          minWidth: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)",
          transition: "width 0.2s ease, min-width 0.2s ease",
          borderRight: "1px solid var(--border)",
          background: "var(--card)",
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: collapsed ? "14px 10px" : "14px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: "8px",
          borderBottom: "1px solid var(--border)",
        }}>
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "8px",
                background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: "700", color: "#fff", fontSize: "11px",
                fontFamily: "'Space Mono', monospace",
              }}>G</div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--foreground)" }}>
                Gemma Chat
              </span>
            </div>
          )}
          {collapsed && (
            <div style={{
              width: "28px", height: "28px", borderRadius: "8px",
              background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: "700", color: "#fff", fontSize: "11px",
              fontFamily: "'Space Mono', monospace",
            }}>G</div>
          )}
          <button
            onClick={onToggle}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--muted-foreground)", padding: "4px",
              borderRadius: "6px", display: "flex", alignItems: "center",
              fontSize: "16px",
            }}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>

        {/* Nova conversa */}
        <div style={{ padding: collapsed ? "10px 8px" : "10px 12px" }}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onNew}
                  style={{ width: "100%", height: "36px" }}
                >
                  ✏️
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Nova conversa</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={onNew}
              style={{ justifyContent: "flex-start", gap: "8px", height: "36px", fontSize: "13px" }}
            >
              <span>✏️</span> Nova conversa
            </Button>
          )}
        </div>

        <Separator />

        {/* Histórico */}
        {!collapsed && (
          <div style={{ padding: "8px 12px 4px", fontSize: "11px", fontWeight: "600", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Histórico
          </div>
        )}

        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: collapsed ? "4px 8px" : "4px 8px" }}>
            {conversations.length === 0 && !collapsed && (
              <div style={{ padding: "12px", fontSize: "12px", color: "var(--muted-foreground)", textAlign: "center" }}>
                Nenhuma conversa ainda
              </div>
            )}
            {conversations.map((conv) => (
              collapsed ? (
                <Tooltip key={conv.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelect(conv.id)}
                      style={{
                        width: "100%", padding: "8px",
                        background: activeId === conv.id ? "var(--muted)" : "transparent",
                        border: "none", borderRadius: "6px", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--foreground)", fontSize: "14px",
                        marginBottom: "2px",
                      }}
                    >
                      💬
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{conv.title}</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  style={{
                    width: "100%", padding: "8px 10px",
                    background: activeId === conv.id ? "var(--muted)" : "transparent",
                    border: "none", borderRadius: "6px", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "flex-start",
                    gap: "2px", marginBottom: "2px", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "var(--foreground)", fontWeight: activeId === conv.id ? "500" : "400", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "210px" }}>
                    {conv.title}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                    {conv.date}
                  </span>
                </button>
              )
            ))}
          </div>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  );
}