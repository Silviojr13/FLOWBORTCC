import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { CouncilAiError, CouncilError, loadMeeting, meetingView, runNextStep } from "@/lib/council-server";

export const runtime = "nodejs";
// Uma fala ou a ata por chamada; a ata com uma IA lenta pode levar um pouco mais.
export const maxDuration = 60;

type Params = { params: Promise<{ id: string; meetingId: string }> };

// POST: a próxima fala da reunião (ou a ata, quando todos já falaram). Só quem abriu a
// reunião a conduz, porque ela usa as IAs dessa pessoa.
export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId, meetingId } = await params;
  const gate = await authorizeProject(projectId, { edit: "assistente" });
  if (gate instanceof Response) return gate;

  const meeting = await loadMeeting(projectId, meetingId);
  if (!meeting) return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
  if (meeting.userId !== gate.user.id) {
    return NextResponse.json({ error: "Só quem abriu a reunião pode continuá-la." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const expectedTurn = Number(body.expectedTurn);

  try {
    await runNextStep(meeting, gate.access, gate.user.id, expectedTurn);
  } catch (error) {
    if (error instanceof CouncilError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CouncilAiError) {
      // 429 com retryAfter: a tela espera e continua sozinha.
      const { kind, retryAfter } = error.cause;
      const status = kind === "rate" ? 429 : kind === "quota" ? 402 : 502;
      return NextResponse.json({ error: error.message, retryAfter: kind === "rate" ? retryAfter : null }, { status });
    }
    console.error("Erro na reunião do conselho:", error);
    return NextResponse.json({ error: "A reunião parou por um erro. Tente continuar de novo." }, { status: 500 });
  }

  const updated = await loadMeeting(projectId, meetingId);
  return NextResponse.json({ meeting: await meetingView(updated!, gate.user.id) });
}
