"use client"

import { ProjectPage } from "@/components/project/project-page"
import { CouncilPanel } from "@/components/council/council-panel"

export default function ProjectCouncilPage() {
  return (
    <ProjectPage
      title="Conselho de IAs"
      description="IAs com cargos discutem o projeto em reunião e propõem os próximos passos numa ata."
      width="focused"
    >
      {(project) => <CouncilPanel projectId={project.id} />}
    </ProjectPage>
  )
}
