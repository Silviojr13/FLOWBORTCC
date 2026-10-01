import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { tursoDb } from "@/lib/turso-db"

export const metadata: Metadata = {
  title: "Boas-vindas | Flowbot",
}

export default async function OnboardingPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const user = await tursoDb.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, onboardingCompletedAt: true },
  })

  if (!user) {
    redirect("/login")
  }

  if (user.onboardingCompletedAt) {
    redirect("/dashboard")
  }

  return <OnboardingFlow userName={user.name} />
}
