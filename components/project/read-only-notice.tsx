"use client"

import { EyeIcon, UserCogIcon } from "lucide-react"
import { ROLE_LABELS, type ProjectRole } from "@/lib/project-permissions"
import type { ProjectDetail } from "@/lib/use-project"

const WHAT_YOU_CAN_DO: Record<Exclude<ProjectRole, "dono">, string> = {
  gestor: "pode editar tudo, convidar pessoas e definir os cargos.",
  funcionario: "edita as tarefas e os componentes; o restante fica para consulta.",
  estagiario:
    "edita e move as tarefas em que é responsável ou participante; o restante fica para consulta.",
  visitante: "pode acompanhar tudo, mas não editar.",
}

/** Aviso para quem não é o dono: explica o cargo e o que ele permite neste projeto. */
export function ReadOnlyNotice({ project }: { project: ProjectDetail }) {
  const { role, canSeeCosts, readOnly } = project.access
  if (role === "dono") return null
  const owner = project.ownerName?.trim()
  const Icon = readOnly ? EyeIcon : UserCogIcon
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p className="leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Você está como {ROLE_LABELS[role].toLowerCase()}</span>
        {owner ? ` no projeto de ${owner}` : ""}: {WHAT_YOU_CAN_DO[role]}
        {canSeeCosts ? "" : " Custos e recursos ficam ocultos."} Para mudar seu cargo, fale com quem
        gerencia o projeto.
      </p>
    </div>
  )
}
