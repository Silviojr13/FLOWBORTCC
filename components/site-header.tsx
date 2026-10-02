import { workspaceGutter } from "@/components/layout/workspace"
import { ThemeToggle } from "@/components/theme-toggle"
import { HelpCenterButton } from "@/components/tutorials/help-center"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
    >
      <div className={cn("flex w-full items-center gap-1 lg:gap-2", workspaceGutter)}>
        <SidebarTrigger className="text-muted-foreground transition-colors duration-150 hover:text-foreground" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-6 bg-border"
        />
        <div className="ml-auto flex items-center gap-1">
          <HelpCenterButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
