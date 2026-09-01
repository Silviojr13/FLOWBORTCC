"use client"

import * as React from "react"
import Link from "next/link"
import { FlowbotBrandLogo } from "@/components/flowbot-brand-logo"
import { useRouter } from "next/navigation"

import { NavUser, type SidebarUser } from "@/components/nav-user"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ChevronDownIcon,
  ClipboardListIcon,
  FolderIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react"
import { ProjectSidebarSection } from "@/components/project-sidebar-section"

export function AppSidebar({
  user,
  isUserLoading = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: SidebarUser | null
  isUserLoading?: boolean
}) {
  const router = useRouter()
  const { setOpen } = useSidebar()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* ── Logo ── */}
      <SidebarHeader className="px-3 pt-4 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-0! hover:bg-transparent!"
            >
              <Link href="/dashboard" className="flex items-center">
                <FlowbotBrandLogo variant="sidebar" priority />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Main content ── */}
      <SidebarContent className="px-3 pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="h-[46px] w-full gap-2 rounded-xl shadow-sm transition-colors duration-200 hover:bg-primary/90"
            >
              <PlusIcon className="size-5" />
              <span className="flex-1 text-left text-sm font-medium">
                Criar novo projeto
              </span>
              <ChevronDownIcon className="size-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
            <DropdownMenuItem
              onClick={() =>
                router.push(`/dashboard?new=ai&t=${Date.now()}`)
              }
              className="gap-2 rounded-md py-2.5 font-medium text-primary focus:bg-primary/10 focus:text-primary"
            >
              <SparklesIcon className="size-4" />
              Criar com IA
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setOpen(false)
                router.push("/dashboard/projects/new/manual")
              }}
              className="gap-2 py-2 text-muted-foreground"
            >
              <ClipboardListIcon className="size-4" />
              Manual
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SidebarMenu className="mt-1">
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/dashboard/projects" className="gap-2 text-sidebar-foreground">
                <FolderIcon className="size-4" />
                Projetos
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <ProjectSidebarSection />

        {/* Flexible spacer — pushes auth + user to bottom */}
        <div className="flex-1" />
      </SidebarContent>

      {/* ── Footer: auth buttons + user ── */}
      <SidebarFooter className="gap-2 px-3 pb-3">
        {/* Separator */}
        <div className="my-1 h-px bg-sidebar-border" />

        {/* User area */}
        <NavUser user={user} isLoading={isUserLoading} />
      </SidebarFooter>
    </Sidebar>
  )
}
