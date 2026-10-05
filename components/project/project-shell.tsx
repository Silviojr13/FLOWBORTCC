"use client"

import { HelpTooltip } from "@/components/help-tooltip"
import { Workspace, type WorkspaceWidth } from "@/components/layout/workspace"
import { ProjectContextNav } from "@/components/project/project-context-nav"
import { FlowbotAssistant } from "@/components/project/flowbot-assistant"
import { ProjectPermissionsProvider } from "@/components/project/project-permissions-context"
import { ReadOnlyNotice } from "@/components/project/read-only-notice"
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
    <ProjectPermissionsProvider permissions={project.access}>
      <Workspace width={width}>
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6">
            <ProjectContextNav projectId={project.id} projectName={project.name} />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

          <ReadOnlyNotice project={project} />

          {children}
        </div>

        {/* O assistente propõe alterações e usa a cota de IA do projeto: só para quem edita. */}
        {project.access.canEdit.assistente && (
          <FlowbotAssistant projectId={project.id} projectName={project.name} />
        )}
      </Workspace>
    </ProjectPermissionsProvider>
  )
}
