"use client"

import { HelpTooltip } from "@/components/help-tooltip"
import { Workspace, type WorkspaceWidth } from "@/components/layout/workspace"
import { ProjectContextNav } from "@/components/project/project-context-nav"
import { ProjectIdentityCard } from "@/components/project-manual/project-identity-card"
import { FlowbotAssistant } from "@/components/project/flowbot-assistant"
import type { ProjectDetail } from "@/lib/use-project"

export function ProjectShell({
  project,
  title,
  description,
  help,
  width = "wide",
  children,
  headerAction,
}: {
  project: ProjectDetail
  title: string
  description?: string
  help?: { label: string; content: string }
  width?: WorkspaceWidth
  children: React.ReactNode
  headerAction?: React.ReactNode
}) {
  return (
    <Workspace width={width}>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-6">
          <ProjectContextNav projectId={project.id} projectName={project.name} />

          <ProjectIdentityCard project={project} />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="flex items-center gap-1 text-lg font-semibold text-foreground">
                {title}
                {help ? <HelpTooltip label={help.label} content={help.content} /> : null}
              </h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {headerAction}
          </div>
        </div>

        {children}
      </div>

      <FlowbotAssistant projectId={project.id} projectName={project.name} />
    </Workspace>
  )
}
