"use client"

import { EyeIcon } from "lucide-react"
import { ROLE_LABELS } from "@/lib/project-permissions"
import type { ProjectDetail } from "@/lib/use-project"

/** Aviso para quem só pode ver o projeto: explica o cargo e de quem é o projeto. */
export function ReadOnlyNotice({ project }: { project: ProjectDetail }) {
  if (!project.access.readOnly) return null
  const owner = project.ownerName?.trim()
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
    >
      <EyeIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p className="leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">
          Você está como {ROLE_LABELS[project.access.role].toLowerCase()}
        </span>
        {owner ? ` no projeto de ${owner}` : ""}: pode acompanhar tudo, mas não editar.
        {project.access.canSeeCosts ? "" : " Custos e recursos ficam ocultos."} Para mudar seu cargo, fale
        com quem compartilhou o projeto.
      </p>
    </div>
  )
}
