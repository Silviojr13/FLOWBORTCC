import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import {
  isDiscoveryValue,
  isProfileValue,
  optionalAnswer,
} from "@/lib/onboarding"
import { tursoDb } from "@/lib/turso-db"

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { message: "Usuário não autenticado." },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Não foi possível ler as respostas." },
      { status: 400 }
    )
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null
  const profile = optionalAnswer(payload?.profile, isProfileValue)
  const discoverySource = optionalAnswer(payload?.discoverySource, isDiscoveryValue)

  if (!profile.ok || !discoverySource.ok) {
    return NextResponse.json(
      { message: "Uma das respostas não é válida." },
      { status: 400 }
    )
  }

  try {
    const existing = await tursoDb.user.findUnique({
      where: { id: user.id },
      select: { onboardingCompletedAt: true },
    })

    if (!existing) {
      return NextResponse.json(
        { message: "Usuário não autenticado." },
        { status: 401 }
      )
    }

    if (existing.onboardingCompletedAt) {
      return NextResponse.json({
        completed: true,
        onboardingCompletedAt: existing.onboardingCompletedAt,
      })
    }

    const completedAt = new Date()
    const saved = await tursoDb.user.updateMany({
      where: { id: user.id, onboardingCompletedAt: null },
      data: {
        profile: profile.value,
        discoverySource: discoverySource.value,
        onboardingCompletedAt: completedAt,
      },
    })

    if (saved.count === 0) {
      const current = await tursoDb.user.findUnique({
        where: { id: user.id },
        select: { onboardingCompletedAt: true },
      })
      return NextResponse.json({
        completed: true,
        onboardingCompletedAt: current?.onboardingCompletedAt ?? completedAt,
      })
    }

    return NextResponse.json({
      completed: true,
      onboardingCompletedAt: completedAt,
    })
  } catch (error) {
    console.error("Erro ao concluir o onboarding:", error)
    return NextResponse.json(
      { message: "Não foi possível salvar o onboarding. Tente novamente." },
      { status: 500 }
    )
  }
}
