"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { onProjectsChanged } from "@/lib/projects-changed"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { ProjectCover } from "@/components/project/project-cover"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  PROJECT_MODULE_GROUPS,
  PROJECT_MODULES,
  extractActiveProjectId,
  getProjectModuleKey,
  type ProjectModuleKey,
} from "@/lib/project-nav"
import { isMemberRole, permissionsFor } from "@/lib/project-permissions"
import { useProjectLocalMeta } from "@/lib/use-project-local-meta"
import { cn } from "@/lib/utils"

interface ProjectListItem {
  id: string
  name: string
  description: string | null
  updatedAt: string
  /** Só nos projetos compartilhados com a pessoa. */
  role?: string
  canSeeCosts?: boolean
}

const RECENT_LIMIT = 5

const navItemClass =
  "h-10 rounded-lg px-2.5 text-sm hover:bg-primary/10! [&_svg]:size-[18px]"

const navItemActiveClass =
  "bg-primary/20! font-medium text-primary! hover:bg-primary/25! hover:text-primary! data-active:bg-primary/20! data-active:font-medium data-active:text-primary! data-active:hover:bg-primary/25! data-active:hover:text-primary!"

function useDismissMobileSidebar() {
  const { isMobile, setOpenMobile } = useSidebar()
  return useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])
}

function RecentProjectLink({ project }: { project: ProjectListItem }) {
  const dismissMobile = useDismissMobileSidebar()
  const meta = useProjectLocalMeta(project.id)
  const name = meta.name?.trim() || project.name

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={name} className={navItemClass}>
        <Link
          href={`/dashboard/projects/${project.id}`}
          onClick={dismissMobile}
          className="gap-2.5"
        >
          <span className="flex size-7 shrink-0 overflow-hidden rounded-md">
            <ProjectCover imageUrl={meta.imageDataUrl} iconClassName="size-3.5" />
          </span>
          <span className="truncate">{name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function ProjectIdentity({
  projectId,
  project,
  isLoading,
}: {
  projectId: string
  project: ProjectListItem | null
  isLoading: boolean
}) {
  const { state, isMobile } = useSidebar()
  const meta = useProjectLocalMeta(projectId)
  const name = meta.name?.trim() || project?.name || "Projeto"
  const description = (meta.description ?? project?.description ?? "").trim()
  const showSkeleton = isLoading && !project && !meta.name

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
          <span className="flex size-10 shrink-0 overflow-hidden rounded-lg group-data-[collapsible=icon]:size-8">
            <ProjectCover imageUrl={meta.imageDataUrl} iconClassName="size-4" />
          </span>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:sr-only">
            {showSkeleton ? (
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            ) : (
              <>
                <p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p>
                {description ? (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" hidden={state !== "collapsed" || isMobile}>
        {name}
      </TooltipContent>
    </Tooltip>
  )
}

export function ProjectSidebarSection() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dismissMobile = useDismissMobileSidebar()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [activeFallback, setActiveFallback] = useState<ProjectListItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const activeProjectId = useMemo(() => extractActiveProjectId(pathname), [pathname])
  const step = searchParams.get("step")

  // Incrementado quando a lista muda (ex.: projeto excluído): recarrega os projetos.
  const [reloadToken, setReloadToken] = useState(0)
  useEffect(() => onProjectsChanged(() => setReloadToken((t) => t + 1)), [])

  useEffect(() => {
    let cancelled = false

    fetch("/api/projects")
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok || cancelled) return
        // Os próprios e os compartilhados com a pessoa, do mais recente ao mais antigo.
        const sorted = [...data.projects, ...(data.shared ?? [])].sort(
          (a: ProjectListItem, b: ProjectListItem) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        setProjects(sorted)
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  useEffect(() => {
    if (!activeProjectId || isLoading) return
    if (projects.some((item) => item.id === activeProjectId)) return

    let cancelled = false
    fetch(`/api/projects/${activeProjectId}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok || cancelled || !data.project) return
        setActiveFallback({
          id: data.project.id,
          name: data.project.name,
          description: data.project.description ?? null,
          updatedAt: data.project.updatedAt,
        })
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [activeProjectId, isLoading, projects])

  if (activeProjectId) {
    const project =
      projects.find((item) => item.id === activeProjectId) ??
      (activeFallback?.id === activeProjectId ? activeFallback : null)
    const activeKey = getProjectModuleKey(pathname, activeProjectId, step)

    return (
      <div className="flex flex-col gap-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Todos os projetos" className={navItemClass}>
              <Link href="/dashboard/projects" onClick={dismissMobile}>
                <ArrowLeftIcon />
                <span>Todos os projetos</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <ProjectIdentity
          projectId={activeProjectId}
          project={project}
          isLoading={isLoading}
        />

        {PROJECT_MODULE_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-1.5">
            <p className="px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase group-data-[collapsible=icon]:sr-only">
              {group.label}
            </p>
            <SidebarMenu className="gap-1">
              {group.keys.map((key) => {
                const navItem = PROJECT_MODULES.find((item) => item.key === key)
                if (!navItem) return null
                // Recursos trazem custos: some para o visitante que não pode vê-los.
                if (key === "resources" && project?.role && !permissionsFor(isMemberRole(project.role) ? project.role : "visitante", project.canSeeCosts).canSeeCosts) {
                  return null
                }
                return (
                  <ModuleLink
                    key={navItem.key}
                    projectId={activeProjectId}
                    moduleKey={navItem.key}
                    activeKey={activeKey}
                    onNavigate={dismissMobile}
                  />
                )
              })}
            </SidebarMenu>
          </div>
        ))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 px-1 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (projects.length === 0) return null

  const recent = projects.slice(0, RECENT_LIMIT)

  return (
    <div className="flex flex-col gap-2 group-data-[collapsible=icon]:hidden">
      <p className="px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Projetos recentes
      </p>
      <SidebarMenu className="gap-1">
        {recent.map((project) => (
          <RecentProjectLink key={project.id} project={project} />
        ))}
      </SidebarMenu>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild className={cn(navItemClass, "text-muted-foreground")}>
            <Link href="/dashboard/projects" onClick={dismissMobile}>
              <span>Ver todos</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  )
}

function ModuleLink({
  projectId,
  moduleKey,
  activeKey,
  onNavigate,
}: {
  projectId: string
  moduleKey: ProjectModuleKey
  activeKey: ProjectModuleKey | null
  onNavigate: () => void
}) {
  const navItem = PROJECT_MODULES.find((item) => item.key === moduleKey)
  if (!navItem) return null

  const Icon = navItem.icon
  const isActive = activeKey === navItem.key

  return (
    <SidebarMenuItem data-tour={`project-nav-${navItem.key}`}>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={navItem.label}
        className={cn(navItemClass, isActive && navItemActiveClass)}
      >
        <Link
          href={navItem.href(projectId)}
          onClick={onNavigate}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon />
          <span>{navItem.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
