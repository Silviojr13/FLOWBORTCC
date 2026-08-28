"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ProjectCreationLayout } from "@/components/project-steps/project-creation-layout"
import { RequirementsTable } from "@/components/project-manual/requirements-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"

interface CreatedProject {
  id: string
  name: string
}

interface ChatImport {
  projectName: string
  requirements: { description: string; category: "Funcional" | "Não Funcional" }[]
}

const CHAT_IMPORT_KEY = "flowbot:chat-requirements"

// Lê o payload do chat (Modo A) uma única vez, na inicialização do estado — evita
// escrever estado dentro de um efeito só para refletir dados já disponíveis no mount.
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

  async function createProject() {
    const trimmed = name.trim()
    if (!trimmed || isCreating) return

    setIsCreating(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, description: description.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao criar projeto")

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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">
            Criar projeto manualmente
          </h1>
          <p className="text-sm text-muted-foreground">
            {project
              ? "Estruture os requisitos funcionais do seu projeto."
              : "Comece dando um nome ao projeto."}
          </p>
        </div>

        {!project ? (
          <FieldGroup className="max-w-md gap-4">
            {chatImport && (
              <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                {chatImport.requirements.length} requisito(s) levantados na conversa serão adicionados
                assim que o projeto for criado.
              </p>
            )}
            <Field>
              <FieldLabel htmlFor="project-name">Nome do projeto</FieldLabel>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Robô seguidor de linha"
                onKeyDown={(e) => e.key === "Enter" && createProject()}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="project-description">Descrição (opcional)</FieldLabel>
              <Input
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Um resumo curto do projeto"
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={createProject} disabled={!name.trim() || isCreating}>
                {isCreating ? "Criando..." : "Criar projeto e continuar"}
              </Button>
              <Button variant="ghost" onClick={() => router.push("/dashboard/projects")}>
                Cancelar
              </Button>
            </div>
          </FieldGroup>
        ) : (
          <>
            <h2 className="text-sm font-medium text-muted-foreground">{project.name}</h2>
            <RequirementsTable
              projectId={project.id}
              initialRequirements={chatImport?.requirements}
            />
          </>
        )}
      </div>
    </ProjectCreationLayout>
  )
}
