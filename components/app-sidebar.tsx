"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  PlusIcon,
  SparklesIcon,
} from "lucide-react"

const user = {
  name: "shadcn",
  email: "m@example.com",
  avatar: "",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()

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
              <a href="/dashboard" className="flex items-center">
                <Image
                  src="/flowbot-logo.svg"
                  alt="FlowBot"
                  width={180}
                  height={60}
                  priority
                  className="h-auto w-auto max-w-[180px] object-contain"
                />
              </a>
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
              className="w-full gap-2 rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-6px_oklch(0.65_0.2_250/40%)] transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_0_24px_-4px_oklch(0.65_0.2_250/55%)]"
              style={{ height: "46px" }}
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
              onClick={() => router.push("/dashboard/projects/new/manual")}
              className="gap-2 py-2 text-muted-foreground"
            >
              <ClipboardListIcon className="size-4" />
              Manual
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Flexible spacer — pushes auth + user to bottom */}
        <div className="flex-1" />
      </SidebarContent>

      {/* ── Footer: auth buttons + user ── */}
      <SidebarFooter className="gap-2 px-3 pb-3">
        {/* Separator */}
        <div className="my-1 h-px bg-white/6" />

        {/* User area */}
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
