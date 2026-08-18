"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, LogOutIcon } from "lucide-react"

export type SidebarUser = {
  name?: string | null
  email?: string | null
  image?: string | null
}

function getDisplayName(user: SidebarUser): string {
  return user.name?.trim() || user.email?.split("@")[0] || "Usuário"
}

function getInitials(user: SidebarUser): string {
  const name = user.name?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase()
    }
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
  }

  if (user.email) {
    return user.email[0].toUpperCase()
  }

  return "?"
}

function UserAvatar({
  user,
  className,
}: {
  user: SidebarUser
  className?: string
}) {
  const displayName = getDisplayName(user)

  return (
    <Avatar className={className}>
      <AvatarImage src={user.image ?? undefined} alt={displayName} />
      <AvatarFallback className="rounded-lg">{getInitials(user)}</AvatarFallback>
    </Avatar>
  )
}

function NavUserSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function NavUser({
  user,
  isLoading = false,
}: {
  user?: SidebarUser | null
  isLoading?: boolean
}) {
  const { isMobile } = useSidebar()
  const [isSigningOut, setIsSigningOut] = useState(false)

  if (isLoading || user === undefined) {
    return <NavUserSkeleton />
  }

  if (!user?.email && !user?.name) {
    return null
  }

  const displayName = getDisplayName(user)
  const email = user.email ?? ""

  const handleSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    try {
      await signOut({ callbackUrl: "/login" })
    } catch (error) {
      console.error("Erro ao sair:", error)
      setIsSigningOut(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar user={user} className="h-8 w-8 rounded-lg" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                {email ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                ) : null}
              </div>
              <EllipsisVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                void handleSignOut()
              }}
              disabled={isSigningOut}
            >
              <LogOutIcon />
              {isSigningOut ? "Saindo..." : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
