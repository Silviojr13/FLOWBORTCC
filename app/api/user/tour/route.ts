import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";
import { createTutorialProject } from "@/lib/tour-seed";

// GET: estado do tour (se deve ser oferecido e qual é o projeto de exemplo).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Usuário não autenticado." }, { status: 401 });
  }

  const [record, tutorial] = await Promise.all([
    tursoDb.user.findUnique({
      where: { id: user.id },
      select: { tourCompletedAt: true },
    }),
    tursoDb.project.findFirst({
      where: { userId: user.id, isTutorial: true },
      select: { id: true },
    }),
  ]);

  return NextResponse.json({
    completed: Boolean(record?.tourCompletedAt),
    projectId: tutorial?.id ?? null,
  });
}

// POST: inicia o tour criando o projeto de exemplo (ou reaproveitando o existente).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Usuário não autenticado." }, { status: 401 });
  }

  try {
    const projectId = await createTutorialProject(user.id);
    return NextResponse.json({ projectId }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar o projeto do tour:", error);
    return NextResponse.json(
      { message: "Não foi possível preparar o projeto de exemplo." },
      { status: 500 }
    );
  }
}

// PATCH: marca o tour como concluído (ou pulado) — some para as próximas sessões.
export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Usuário não autenticado." }, { status: 401 });
  }

  try {
    await tursoDb.user.update({
      where: { id: user.id },
      data: { tourCompletedAt: new Date() },
    });
    return NextResponse.json({ completed: true });
  } catch (error) {
    console.error("Erro ao concluir o tour:", error);
    return NextResponse.json(
      { message: "Não foi possível registrar a conclusão do tour." },
      { status: 500 }
    );
  }
}
