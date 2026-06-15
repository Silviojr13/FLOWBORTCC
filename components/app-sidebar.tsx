"use client"

import * as React from "react"
import Image from "next/image"

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
import { PlusIcon } from "lucide-react"

const user = {
  name: "shadcn",
  email: "m@example.com",
  avatar: "",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
              <a href="/" className="flex items-center">
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
        {/* Primary CTA — Criar Projeto */}
        <Button
          size="lg"
          className="w-full gap-2 rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-6px_oklch(0.65_0.2_250/40%)] transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_0_24px_-4px_oklch(0.65_0.2_250/55%)]"
          style={{ height: "46px" }}
        >
          <PlusIcon className="size-5" />
          <span className="text-sm font-medium">Criar Projeto</span>
        </Button>

        {/* Flexible spacer — pushes auth + user to bottom */}
        <div className="flex-1" />
      </SidebarContent>

      {/* ── Footer: auth buttons + user ── */}
      <SidebarFooter className="gap-2 px-3 pb-3">
        <Button
          size="lg"
          className="w-full rounded-xl bg-primary text-primary-foreground transition-all duration-200 hover:bg-primary/90"
          style={{ height: "44px" }}
        >
          Registrar
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full rounded-xl border-white/10 bg-white/4 text-foreground transition-all duration-200 hover:border-white/20 hover:bg-white/8"
          style={{ height: "44px" }}
        >
          Login
        </Button>

        {/* Separator */}
        <div className="my-1 h-px bg-white/6" />

        {/* User area */}
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
