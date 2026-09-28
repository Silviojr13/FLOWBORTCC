"use client";

import ReactMarkdown from "react-markdown";
import { BotIcon, SaveIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { messageHasGeneratedRequirements } from "@/lib/parse-requirements";
import { stripFlowbotActions } from "@/lib/flowbot-actions";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Renderização markdown das respostas do assistente, compartilhada entre a tela de chat
// e o assistente flutuante do projeto.
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-3 mb-1.5 text-lg font-semibold">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-2.5 mb-1 text-base font-semibold">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => <p className="my-1">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-muted/60 p-3 font-mono text-xs">
      {children}
    </pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-1 list-inside list-disc pl-3">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-1 list-inside list-decimal pl-3">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="my-0.5">{children}</li>,
};

export function MessageBubble({
  msg,
  onSaveRequirements,
  compact = false,
}: {
  msg: ChatMessage;
  onSaveRequirements?: (content: string) => void;
  compact?: boolean;
}) {
  const isUser = msg.role === "user";
  // O bloco flowbot-actions é protocolo interno: vira card de confirmação, não texto.
  const text = isUser ? msg.content : stripFlowbotActions(msg.content);
  const hasRequirements =
    !isUser && !!onSaveRequirements && messageHasGeneratedRequirements(msg.content);

  return (
    <div
      className={cn(
        "animate-fade-in-up flex gap-3",
        compact && "gap-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full transition-colors duration-150",
          compact ? "size-6" : "size-8",
          isUser
            ? "bg-primary/10 text-primary"
            : "border border-border bg-muted text-muted-foreground"
        )}
      >
        {isUser ? (
          <UserIcon className={compact ? "size-3" : "size-3.5"} />
        ) : (
          <BotIcon className={compact ? "size-3" : "size-3.5"} />
        )}
      </div>

      <div
        className={cn(
          "rounded-xl leading-relaxed transition-shadow duration-150",
          compact ? "max-w-[88%] px-3 py-2 text-[13px]" : "max-w-[85%] px-4 py-3 text-sm sm:max-w-[75%]",
          isUser
            ? "rounded-tr-md bg-blue-light text-navy dark:bg-accent dark:text-accent-foreground"
            : "rounded-tl-md border border-border bg-card text-foreground shadow-sm"
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
        )}

        {hasRequirements && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 gap-1.5"
            onClick={() => onSaveRequirements?.(msg.content)}
          >
            <SaveIcon className="size-3.5" />
            Salvar requisitos em um projeto
          </Button>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  );
}
