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
  onSend: () => void;
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
    <div className="safe-bottom sticky bottom-0 z-30 px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-195">
        {/* Glass container */}
        <div className="rounded-2xl border border-white/8 bg-[oklch(0.12_0.02_260/80%)] p-2 shadow-[0_-4px_30px_-8px_oklch(0_0_0/50%)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 focus-within:border-primary/20 focus-within:shadow-[0_-4px_30px_-8px_oklch(0.65_0.2_250/20%)]">
          {/* Textarea row */}
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
              className="min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-1 pt-1.5">
            {/* Left: action icons */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground/40 transition-colors duration-150 hover:text-muted-foreground"
              >
                <PaperclipIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground/40 transition-colors duration-150 hover:text-muted-foreground"
              >
                <MicIcon className="size-4" />
              </Button>
            </div>

            {/* Right: send / stop */}
            {isStreaming ? (
              <Button
                variant="destructive"
                size="icon-sm"
                onClick={onStop}
                className="rounded-xl transition-all duration-150"
              >
                <SquareIcon className="size-3.5" />
              </Button>
            ) : (
              <Button
                size="icon-sm"
                onClick={onSend}
                disabled={!input.trim()}
                className="rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-6px_oklch(0.65_0.2_250/50%)] transition-all hover:bg-primary/90 hover:shadow-[0_0_24px_-4px_oklch(0.65_0.2_250/60%)] disabled:shadow-none"
              >
                <ArrowUpIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Helper text */}
        <p className="mt-2 text-center text-[11px] text-muted-foreground/40">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
