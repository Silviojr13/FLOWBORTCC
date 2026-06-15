import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-white/5 bg-background/70 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
    >
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 text-muted-foreground transition-colors duration-150 hover:text-foreground" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-6 bg-white/10"
        />
        {/* <h1 className="text-base font-medium tracking-wide text-foreground/90">
          FLOWBOT
        </h1> */}
      </div>
    </header>
  )
}
