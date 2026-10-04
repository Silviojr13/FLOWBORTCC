import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tursoDb } from "@/lib/turso-db";

// GET: o que será apagado junto com o projeto, para a confirmação de exclusão mostrar o
// impacto real antes de a pessoa decidir.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const project = await tursoDb.project.findUnique({
    where: { id: projectId, userId: user.id },
    select: {
      name: true,
      isTutorial: true,
      _count: {
        select: {
          requirements: true,
          features: true,
          tasks: true,
          sprints: true,
          components: true,
          resources: true,
          diagrams: true,
          chats: true,
        },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });

  return NextResponse.json({ name: project.name, isTutorial: project.isTutorial, counts: project._count });
}
