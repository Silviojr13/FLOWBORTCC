"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getProjectCrumbLabel, isProjectOverview } from "@/lib/project-nav"
import { useProjectLocalMeta } from "@/lib/use-project-local-meta"

export function ProjectContextNav({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const meta = useProjectLocalMeta(projectId)
  const displayName = meta.name?.trim() || projectName
  const step = searchParams.get("step")
  const onOverview = isProjectOverview(pathname, projectId, step)
  const currentLabel = getProjectCrumbLabel(pathname, projectId, step)
  const overviewHref = `/dashboard/projects/${projectId}`

  const backHref = onOverview ? "/dashboard/projects" : overviewHref
  const backLabel = onOverview ? "Projetos" : displayName

  const crumbs = onOverview
    ? [
        { label: "Projetos", href: "/dashboard/projects" },
        { label: displayName },
      ]
    : [
        { label: "Projetos", href: "/dashboard/projects" },
        { label: displayName, href: overviewHref },
        { label: currentLabel ?? "Projeto" },
      ]

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit max-w-full gap-1.5 px-2 text-muted-foreground"
        asChild
      >
        <Link href={backHref}>
          <ArrowLeftIcon className="size-4 shrink-0" />
          <span className="truncate">{backLabel}</span>
        </Link>
      </Button>

      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                <BreadcrumbItem className="max-w-48 min-w-0">
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild className="truncate">
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
