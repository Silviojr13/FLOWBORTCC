"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { BotIcon, PencilIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { loadProjectLocalMeta, saveProjectLocalMeta } from "@/lib/project-local-meta"
import { cn } from "@/lib/utils"

export interface ProjectIdentity {
  id: string
  name: string
  description?: string | null
}

export function ProjectIdentityCard({
  project,
  className,
}: {
  project: ProjectIdentity
  className?: string
}) {
  const [editOpen, setEditOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(() => {
    const meta = loadProjectLocalMeta(project.id)
    return meta.name ?? project.name
  })
  const [displayDescription, setDisplayDescription] = useState(() => {
    const meta = loadProjectLocalMeta(project.id)
    return meta.description ?? project.description ?? ""
  })
  const [imageUrl, setImageUrl] = useState<string | undefined>(() => {
    return loadProjectLocalMeta(project.id).imageDataUrl
  })
  const [draftName, setDraftName] = useState(displayName)
  const [draftDescription, setDraftDescription] = useState(displayDescription)
  const [draftImage, setDraftImage] = useState<string | undefined>(imageUrl)

  function openEdit() {
    setDraftName(displayName)
    setDraftDescription(displayDescription)
    setDraftImage(imageUrl)
    setEditOpen(true)
  }

  function handleImageChange(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDraftImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  function saveEdit() {
    const meta = {
      name: draftName.trim() || project.name,
      description: draftDescription.trim(),
      imageDataUrl: draftImage,
    }
    saveProjectLocalMeta(project.id, meta)
    setDisplayName(meta.name)
    setDisplayDescription(meta.description)
    setImageUrl(meta.imageDataUrl)
    setEditOpen(false)
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border/80 bg-card/80 px-3 py-2.5 shadow-sm",
          className
        )}
      >
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              width={44}
              height={44}
              className="size-full object-cover"
              unoptimized
            />
          ) : (
            <BotIcon className="size-5 text-primary/70" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          {displayDescription && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {displayDescription}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground"
          onClick={openEdit}
        >
          <PencilIcon className="size-3.5" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Editar</span>
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar identidade do projeto</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 hover:bg-muted/60"
              >
                {draftImage ? (
                  <Image
                    src={draftImage}
                    alt=""
                    width={64}
                    height={64}
                    className="size-full object-cover"
                    unoptimized
                  />
                ) : (
                  <BotIcon className="size-6 text-muted-foreground" />
                )}
              </button>
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  {draftImage ? "Trocar imagem" : "Adicionar imagem"}
                </Button>
                {draftImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start px-0 text-muted-foreground"
                    onClick={() => setDraftImage(undefined)}
                  >
                    Remover imagem
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Imagem opcional — salva apenas neste navegador.
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e.target.files?.[0])}
              />
            </div>

            <Field>
              <FieldLabel htmlFor="identity-name">Nome</FieldLabel>
              <Input
                id="identity-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="identity-description">Descrição</FieldLabel>
              <Textarea
                id="identity-description"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                rows={3}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Nome, descrição e imagem são salvos localmente neste navegador.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
