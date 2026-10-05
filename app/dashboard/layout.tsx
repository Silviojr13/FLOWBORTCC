import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TourLauncher } from "@/components/tour/tour-launcher"
import { ParticipantPanel } from "@/components/study/participant-panel"
import { HelpCenter } from "@/components/tutorials/help-center"
import { PageTutorialRunner } from "@/components/tutorials/page-tutorial-runner"
import { PendingInviteRedirect } from "@/components/sharing/pending-invite-redirect"
import BackgroundAnimation from "@/components/background-animation"
import { tursoDb } from "@/lib/turso-db"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (session?.user?.id) {
    const user = await tursoDb.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingCompletedAt: true },
    })

    if (user && !user.onboardingCompletedAt) {
      redirect("/onboarding")
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 76)",
          "--sidebar-width-icon": "3.25rem",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <BackgroundAnimation />

      <AppSidebar variant="inset" user={session?.user ?? null} />
      <SidebarInset className="bg-background">
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-6 lg:py-8">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Convite de projeto aberto antes do login: leva de volta a ele. */}
      <PendingInviteRedirect />

      {/* Tour guiado da primeira sessão (só aparece para quem ainda não o concluiu). */}
      <TourLauncher />

      {/* Guia do participante: só para quem aceitou (ou recebeu) um convite de avaliação. */}
      <ParticipantPanel />

      {/* Central de tutoriais (botão "Tutoriais" no cabeçalho) e o executor dos tutoriais por tela. */}
      <HelpCenter />
      <PageTutorialRunner />
    </SidebarProvider>
  )
}
