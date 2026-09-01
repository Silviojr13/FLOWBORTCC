"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ProjectCreationLayout } from "@/components/project-steps/project-creation-layout"
import { ProjectIdentityCard } from "@/components/project-manual/project-identity-card"
import { RequirementsTable } from "@/components/project-manual/requirements-table"
import { AiChatAssistButton } from "@/components/project-manual/ai-assist-button"
import { MANUAL_STEP_CONTENT } from "@/lib/manual-step-content"
import { saveProjectLocalMeta } from "@/lib/project-local-meta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ArrowRightIcon } from "lucide-react"

interface CreatedProject {
  id: string
  name: string
  description?: string | null
}

interface ChatImport {
  projectName: string
  requirements: { description: string; category: "Funcional" | "Não Funcional" }[]
}

const CHAT_IMPORT_KEY = "flowbot:chat-requirements"

function readChatImport(): ChatImport | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(CHAT_IMPORT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ChatImport
  } catch {
    return null
  }
}

export default function ManualProjectPage() {
  const router = useRouter()
  const [project, setProject] = useState<CreatedProject | null>(null)
  const [chatImport] = useState<ChatImport | null>(readChatImport)
  const [name, setName] = useState(() => readChatImport()?.projectName ?? "")
  const [description, setDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const stepContent = MANUAL_STEP_CONTENT.requisitos

  async function createProject() {
    const trimmed = name.trim()
    if (!trimmed || isCreating) return

    setIsCreating(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || undefined,
          origin: chatImport ? "ia" : "manual",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao criar projeto")

      saveProjectLocalMeta(data.project.id, {
        name: trimmed,
        description: description.trim(),
      })

      setProject(data.project)
      sessionStorage.removeItem(CHAT_IMPORT_KEY)
      toast.success("Projeto criado.")
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao criar projeto.")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <ProjectCreationLayout currentStep="requisitos">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {!project ? (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-navy dark:text-foreground sm:text-3xl">
                Dê um nome ao seu projeto
              </h1>
              <p className="text-sm text-muted-foreground">
                Comece identificando sua ideia. Você poderá estruturar os detalhes nas próximas
                etapas.
              </p>
            </div>

            <FieldGroup className="max-w-lg gap-4">
              {chatImport && (
                <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                  {chatImport.requirements.length} requisito(s) levantados na conversa serão
                  adicionados assim que o projeto for criado.
                </p>
              )}
              <Field>
                <FieldLabel htmlFor="project-name">Nome do projeto</FieldLabel>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Estufa inteligente"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="project-description">Descrição</FieldLabel>
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva brevemente a ideia do projeto"
                  rows={4}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={createProject} disabled={!name.trim() || isCreating}>
                  {isCreating ? "Criando..." : "Criar projeto e continuar"}
                </Button>
                <Button variant="ghost" onClick={() => router.push("/dashboard/projects")}>
                  Cancelar
                </Button>
              </div>
            </FieldGroup>
          </>
        ) : (
          <>
            <ProjectIdentityCard project={project} />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-foreground">{stepContent.title}</h2>
                <p className="text-sm text-muted-foreground">{stepContent.description}</p>
              </div>
              <AiChatAssistButton />
            </div>

            <RequirementsTable
              projectId={project.id}
              initialRequirements={chatImport?.requirements}
            />

            <div className="flex justify-end border-t pt-4">
              <Button
                className="gap-1.5"
                onClick={() => router.push(`/dashboard/projects/${project.id}?step=funcionalidades`)}
              >
                Continuar
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </ProjectCreationLayout>
  )
}
