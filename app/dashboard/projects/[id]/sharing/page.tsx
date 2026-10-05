"use client"

import { ProjectPage } from "@/components/project/project-page"
import { SharingPanel } from "@/components/sharing/sharing-panel"

export default function ProjectSharingPage() {
  return (
    <ProjectPage
      title="Compartilhamento"
      description="Quem participa do projeto, com qual cargo, e os convites."
      width="focused"
    >
      {(project) => <SharingPanel projectId={project.id} />}
    </ProjectPage>
  )
}
