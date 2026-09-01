"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  BotIcon,
  KanbanIcon,
  LayoutGridIcon,
  PackageIcon,
  SparklesIcon,
} from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { loadProjectLocalMeta } from "@/lib/project-local-meta"
import { cn } from "@/lib/utils"

interface ProjectListItem {
  id: string
  name: string
  updatedAt: string
}

const RECENT_LIMIT = 5

function ProjectThumbnail({ projectId }: { projectId: string }) {
  const imageUrl = useMemo(() => {
    if (typeof window === "undefined") return null
    return loadProjectLocalMeta(projectId).imageDataUrl ?? null
  }, [projectId])

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className="size-5 shrink-0 rounded object-cover"
      />
    )
  }

  return <BotIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
}

function extractActiveProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/projects\/([^/?]+)/)
  if (!match || match[1] === "new") return null
  return match[1]
}

export function ProjectSidebarSection() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const activeProjectId = useMemo(() => extractActiveProjectId(pathname), [pathname])
  const showModules =
    activeProjectId !== null &&
    !searchParams.get("step") &&
    pathname.startsWith(`/dashboard/projects/${activeProjectId}`)

  useEffect(() => {
    let cancelled = false

    fetch("/api/projects")
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok || cancelled) return
        const sorted = [...data.projects].sort(
          (a: ProjectListItem, b: ProjectListItem) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        setProjects(sorted.slice(0, RECENT_LIMIT))
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="px-2 py-2 text-xs text-muted-foreground">Carregando projetos...</div>
    )
  }

  if (projects.length === 0) return null

  const modules = activeProjectId
    ? [
        {
          href: `/dashboard/projects/${activeProjectId}`,
          label: "Visão geral",
          icon: LayoutGridIcon,
          exact: true,
        },
        {
          href: `/dashboard/projects/${activeProjectId}/features`,
          label: "Funcionalidades",
          icon: SparklesIcon,
        },
        {
          href: `/dashboard/projects/${activeProjectId}/components-costs`,
          label: "Componentes e Custos",
          icon: PackageIcon,
        },
        {
          href: `/dashboard/projects/${activeProjectId}/kanban`,
          label: "Kanban",
          icon: KanbanIcon,
        },
      ]
    : []

  return (
    <div className="mt-4 flex flex-col gap-1">
      <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Projetos recentes
      </p>
      <SidebarMenu>
        {projects.map((project) => {
          const isActive = project.id === activeProjectId
          const overviewHref = `/dashboard/projects/${project.id}`

          return (
            <SidebarMenuItem key={project.id}>
              <SidebarMenuButton
                asChild
                isActive={isActive && !showModules}
                className={cn(isActive && "bg-primary/10 text-primary")}
              >
                <Link href={overviewHref} className="gap-2">
                  <ProjectThumbnail projectId={project.id} />
                  <span className="truncate">{project.name}</span>
                </Link>
              </SidebarMenuButton>

              {isActive && showModules && (
                <SidebarMenuSub>
                  {modules.map(({ href, label, icon: Icon, exact }) => {
                    const isModuleActive = exact
                      ? pathname === href
                      : pathname.startsWith(href)

                    return (
                      <SidebarMenuSubItem key={href}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isModuleActive}
                          className={cn(
                            isModuleActive && "bg-primary/10 text-primary"
                          )}
                        >
                          <Link href={href}>
                            <Icon className="size-4" />
                            <span>{label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )
                  })}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>

      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild className="text-xs text-muted-foreground">
            <Link href="/dashboard/projects">Ver todos</Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  )
}
