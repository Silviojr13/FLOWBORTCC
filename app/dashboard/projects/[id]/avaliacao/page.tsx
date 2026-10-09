"use client"

import { ProjectPage } from "@/components/project/project-page"
import { AdminStudies } from "@/components/study/admin-studies"

export default function ProjectEvaluationPage() {
  return (
    <ProjectPage
      title="Avaliação"
      description="Convide participantes, acompanhe as tarefas do roteiro e a nota do questionário SUS."
    >
      {(project) =>
        project.access.role === "dono" || project.access.role === "gestor" ? (
          <AdminStudies projectId={project.id} />
        ) : (
          <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            Só o dono e os gestores do projeto acessam a avaliação: as respostas dos participantes são
            dados pessoais.
          </p>
        )
      }
    </ProjectPage>
  )
}
