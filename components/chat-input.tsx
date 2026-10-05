"use client";

import { useRef, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ArrowUpIcon,
  SquareIcon,
  PaperclipIcon,
  MicIcon,
  FileTextIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react";
import {
  ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
  isAcceptedAttachment,
  prepareAttachment,
  withAttachment,
  type ChatAttachment,
} from "@/lib/chat-attachments";
import { useVoiceInput } from "@/lib/use-voice-input";
import { cn } from "@/lib/utils";

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ChatInput({
  embedded = false,
  input,
  onInputChange,
  onSend,
  isStreaming,
  onStop,
}: {
  embedded?: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
  isStreaming: boolean;
  onStop: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const voice = useVoiceInput({ text: input, onText: onInputChange });
  const voiceActive = voice.state === "listening" || voice.state === "recording";

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const canSend = (input.trim().length > 0 || attachment !== null) && voice.state !== "transcribing";

  function send() {
    if (!canSend || isStreaming) return;
    if (voiceActive) voice.toggle();
    onSend(withAttachment(input, attachment));
    setAttachment(null);
  }

  async function pickFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!isAcceptedAttachment(file.name)) {
      toast.error("Por enquanto o chat lê arquivos de texto, dados e código (.txt, .md, .csv, .json, .ino, .py...).");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Arquivo grande demais. Envie um arquivo de até 300 KB.");
      return;
    }
    const prepared = prepareAttachment(file.name, await file.text());
    if (!prepared.content) {
      toast.error("O arquivo está vazio.");
      return;
    }
    setAttachment(prepared);
    if (prepared.truncated) {
      toast.info("O arquivo é longo: só o começo será enviado, por causa do limite da IA.");
    }
    textareaRef.current?.focus();
  }

  return (
    <div className="safe-bottom sticky bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-0 pb-3 pt-2 sm:pb-4">
      <div className={embedded ? "w-full" : "mx-auto w-full max-w-3xl"}>
        <div data-tour="home-chat-input" className="rounded-xl border border-border bg-card p-2 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
          {attachment && (
            <div className="px-1 pb-1">
              <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-muted/60 py-1 pr-1 pl-2 text-xs text-foreground">
                <FileTextIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{attachment.name}</span>
                {attachment.truncated && <span className="shrink-0 text-muted-foreground">(só o começo)</span>}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 shrink-0 text-muted-foreground"
                  aria-label={`Remover o anexo ${attachment.name}`}
                  onClick={() => setAttachment(null)}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </span>
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={voiceActive ? "Pode falar, estou ouvindo..." : "Digite sua ideia..."}
              rows={1}
              className="min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between px-1 pt-1.5">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept={ATTACHMENT_EXTENSIONS.join(",")}
                className="hidden"
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                title="Anexar arquivo de texto"
                aria-label="Anexar arquivo de texto"
                disabled={isStreaming}
                onClick={() => fileRef.current?.click()}
                className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <PaperclipIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title={voiceActive ? "Parar de ditar" : "Ditar mensagem"}
                aria-label={voiceActive ? "Parar de ditar" : "Ditar mensagem"}
                aria-pressed={voiceActive}
                disabled={isStreaming || voice.state === "transcribing"}
                onClick={voice.toggle}
                className={cn(
                  "transition-colors duration-150",
                  voiceActive
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {voice.state === "transcribing" ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : voiceActive ? (
                  <SquareIcon className="size-3.5" />
                ) : (
                  <MicIcon className="size-4" />
                )}
              </Button>
              {voiceActive && (
                <span className="flex items-center gap-1.5 text-xs text-destructive" aria-live="polite">
                  <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
                  {formatSeconds(voice.seconds)}
                </span>
              )}
              {voice.state === "transcribing" && (
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  Transcrevendo...
                </span>
              )}
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
                onClick={send}
                disabled={!canSend}
                aria-label="Enviar mensagem"
                className="rounded-lg transition-colors duration-150"
              >
                <ArrowUpIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Enter para enviar · Shift+Enter para nova linha · 📎 anexa arquivo de texto · 🎤 dita a mensagem
        </p>
      </div>
    </div>
  );
}
