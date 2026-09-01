"use client"

import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProjectIdentityCard } from "@/components/project-manual/project-identity-card"
import type { ProjectDetail } from "@/lib/use-project"

export function ProjectShell({
  project,
  title,
  description,
  children,
  headerAction,
}: {
  project: ProjectDetail
  title: string
  description?: string
  children: React.ReactNode
  headerAction?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit gap-1.5 px-2 text-muted-foreground"
        asChild
      >
        <Link href="/dashboard/projects">
          <ArrowLeftIcon className="size-4" />
          Projetos
        </Link>
      </Button>

      <ProjectIdentityCard project={project} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {headerAction}
      </div>

      {children}
    </div>
  )
}
