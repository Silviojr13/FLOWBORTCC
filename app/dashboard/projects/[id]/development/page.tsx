"use client"

import { ProjectPage } from "@/components/project/project-page"
import { DevNotesPanel } from "@/components/project/dev-notes-panel"

export default function ProjectDevelopmentPage() {
  return (
    <ProjectPage
      title="Desenvolvimento"
      description="O que o Claude Code desenvolveu, os problemas e as dúvidas, registrados pela ponte com o FlowBot."
      width="focused"
    >
      {(project) => <DevNotesPanel projectId={project.id} />}
    </ProjectPage>
  )
}
