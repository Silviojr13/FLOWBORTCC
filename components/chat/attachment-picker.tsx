"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { FileTextIcon, LoaderCircleIcon, PaperclipIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  uploadAttachment,
  type ChatAttachment,
} from "@/lib/chat-attachments"
import { cn } from "@/lib/utils"

/**
 * Anexo de um arquivo à próxima mensagem, igual no chat principal e no assistente do
 * projeto: o servidor lê o arquivo (PDF e Word viram texto) e devolve o texto pronto.
 */
export function useAttachmentPicker(onReady?: () => void) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null)
  const [reading, setReading] = useState<string | null>(null)

  async function pick(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""
    if (!file) return
    setReading(file.name)
    try {
      const read = await uploadAttachment(file)
      setAttachment(read)
      if (read.truncated) {
        toast.info(
          "O documento é longo: vai uma versão condensada, com os títulos, as listas e os trechos com requisitos e regras. Para mandar inteiro, conecte uma IA sua em Minhas IAs."
        )
      }
      onReady?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o arquivo.")
    } finally {
      setReading(null)
    }
  }

  return {
    attachment,
    reading,
    clear: () => setAttachment(null),
    open: () => inputRef.current?.click(),
    input: (
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_ATTACHMENT_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    ),
  }
}

export function AttachButton({
  onClick,
  disabled,
  reading,
  className,
}: Readonly<{
  onClick: () => void
  disabled?: boolean
  reading?: boolean
  className?: string
}>) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title="Anexar documento (PDF, Word, Markdown, texto ou código)"
      aria-label="Anexar documento"
      disabled={disabled || reading}
      onClick={onClick}
      className={cn("text-muted-foreground transition-colors duration-150 hover:text-foreground", className)}
    >
      {reading ? <LoaderCircleIcon className="size-4 animate-spin" /> : <PaperclipIcon className="size-4" />}
    </Button>
  )
}

/** O arquivo anexado (ou sendo lido), com o botão de remover. */
export function AttachmentChip({
  attachment,
  reading,
  onRemove,
}: Readonly<{
  attachment: ChatAttachment | null
  reading: string | null
  onRemove: () => void
}>) {
  if (!attachment && !reading) return null
  const name = attachment?.name ?? reading ?? ""
  return (
    <div className="px-1 pb-1">
      <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-muted/60 py-1 pr-1 pl-2 text-xs text-foreground">
        {reading ? (
          <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />
        ) : (
          <FileTextIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
        )}
        <span className="truncate">{name}</span>
        {reading && <span className="shrink-0 text-muted-foreground">lendo…</span>}
        {attachment?.truncated && <span className="shrink-0 text-muted-foreground">(condensado)</span>}
        {attachment && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 shrink-0 text-muted-foreground"
            aria-label={`Remover o anexo ${attachment.name}`}
            onClick={onRemove}
          >
            <XIcon className="size-3.5" />
          </Button>
        )}
      </span>
    </div>
  )
}
