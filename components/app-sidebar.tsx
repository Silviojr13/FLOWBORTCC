"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BotIcon, FolderIcon, PlusIcon } from "lucide-react"

import { FlowbotBrandLogo, FlowbotMark } from "@/components/flowbot-brand-logo"
import { NavUser, type SidebarUser } from "@/components/nav-user"
import { ProjectSidebarSection } from "@/components/project-sidebar-section"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { extractActiveProjectId } from "@/lib/project-nav"
import { cn } from "@/lib/utils"

const navItemClass =
  "h-10 rounded-lg px-2.5 text-sm hover:bg-primary/10! [&_svg]:size-[18px]"

const navItemActiveClass =
  "bg-primary/20! font-medium text-primary! hover:bg-primary/25! hover:text-primary! data-active:bg-primary/20! data-active:font-medium data-active:text-primary! data-active:hover:bg-primary/25! data-active:hover:text-primary!"

function useDismissMobileSidebar() {
  const { isMobile, setOpenMobile } = useSidebar()
  return React.useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])
}

export function AppSidebar({
  user,
  isUserLoading = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: SidebarUser | null
  isUserLoading?: boolean
}) {
  const pathname = usePathname()
  const dismissMobile = useDismissMobileSidebar()
  const inProject = extractActiveProjectId(pathname) !== null
  const projectsActive =
    pathname === "/dashboard/projects" || pathname.startsWith("/dashboard/projects/new")
  const aiKeysActive = pathname === "/dashboard/minhas-ias"

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-3 pt-4 pb-2 group-data-[collapsible=icon]:px-1.5">
        <Link
          href="/dashboard"
          aria-label="Flowbot"
          onClick={dismissMobile}
          className="flex h-10 items-center rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <span className="group-data-[collapsible=icon]:hidden">
            <FlowbotBrandLogo
              variant="sidebar"
              priority
              className={inProject ? "max-w-[140px]" : undefined}
            />
          </span>
          <FlowbotMark className="hidden size-8 group-data-[collapsible=icon]:block" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-3 pt-2 group-data-[collapsible=icon]:px-1.5">
        {!inProject && (
          <>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Criar novo projeto"
                  className="h-11 bg-primary! px-3 text-primary-foreground! shadow-sm hover:bg-primary/90! hover:text-primary-foreground! active:bg-primary/90! active:text-primary-foreground! [&_svg]:size-[18px]"
                >
                  <Link
                    href="/dashboard/projects/new"
                    aria-label="Criar novo projeto"
                    onClick={dismissMobile}
                  >
                    <PlusIcon />
                    <span className="font-medium group-data-[collapsible=icon]:hidden">
                      Criar novo projeto
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={projectsActive}
                  tooltip="Projetos"
                  className={cn(navItemClass, projectsActive && navItemActiveClass)}
                >
                  <Link
                    href="/dashboard/projects"
                    onClick={dismissMobile}
                    aria-current={projectsActive ? "page" : undefined}
                  >
                    <FolderIcon />
                    <span>Projetos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={aiKeysActive}
                  tooltip="Minhas IAs"
                  className={cn(navItemClass, aiKeysActive && navItemActiveClass)}
                >
                  <Link
                    href="/dashboard/minhas-ias"
                    onClick={dismissMobile}
                    aria-current={aiKeysActive ? "page" : undefined}
                  >
                    <BotIcon />
                    <span>Minhas IAs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}

        <ProjectSidebarSection />

        <div className="flex-1" />
      </SidebarContent>

      <SidebarFooter className="gap-2 px-3 pb-3 group-data-[collapsible=icon]:px-1.5">
        <div className="my-1 h-px bg-sidebar-border" />
        <NavUser user={user} isLoading={isUserLoading} />
      </SidebarFooter>
    </Sidebar>
  )
}
