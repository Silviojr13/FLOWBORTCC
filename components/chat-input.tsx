"use client";

import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowUpIcon,
  SquareIcon,
  PaperclipIcon,
  MicIcon,
} from "lucide-react";

export function ChatInput({
  input,
  onInputChange,
  onSend,
  isStreaming,
  onStop,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
  isStreaming: boolean;
  onStop: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  return (
    <div className="safe-bottom sticky bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-195">
        <div className="rounded-xl border border-border bg-card p-2 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Digite sua ideia..."
              rows={1}
              className="min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between px-1 pt-1.5">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <PaperclipIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <MicIcon className="size-4" />
              </Button>
            </div>

            {isStreaming ? (
              <Button
                variant="destructive"
                size="icon-sm"
                onClick={onStop}
                className="rounded-lg transition-colors duration-150"
              >
                <SquareIcon className="size-3.5" />
              </Button>
            ) : (
              <Button
                size="icon-sm"
                onClick={() => onSend()}
                disabled={!input.trim()}
                className="rounded-lg transition-colors duration-150"
              >
                <ArrowUpIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
