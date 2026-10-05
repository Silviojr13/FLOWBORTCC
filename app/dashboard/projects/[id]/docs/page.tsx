"use client"

import { ProjectPage } from "@/components/project/project-page"
import { DocsWorkspace } from "@/components/docs/docs-workspace"

export default function ProjectDocsPage() {
  return (
    <ProjectPage
      title="Documentação"
      description="Documentos de engenharia do projeto nas normas ISO/IEC/IEEE, escritos a partir dos dados e exportáveis em PDF."
      width="wide"
    >
      {(project) => <DocsWorkspace projectId={project.id} projectName={project.name} />}
    </ProjectPage>
  )
}
