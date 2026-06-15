import { AppSidebar } from "@/components/app-sidebar"
import ChatPage  from "@/components/chatbot"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import BackgroundAnimation from "@/components/background-animation"


export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      {/* Animated neural background */}
      <BackgroundAnimation />

      <AppSidebar variant="inset" />
      <SidebarInset className="relative z-10 bg-transparent">
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <ChatPage />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
