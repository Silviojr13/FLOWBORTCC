import { tursoDb } from "./turso-db";
import { PROFILE_QUESTIONS, STUDY_TASKS, SUS_ITEMS, type StudyAnswers } from "./study";

/**
 * Resultados de uma avaliação para o painel do admin. Os participantes aparecem só como
 * P01, P02… (ordem de aceite): o painel não expõe nome nem e-mail.
 */

export interface ParticipantResult {
  id: string
  label: string
  consentAt: string
  submittedAt: string | null
  susScore: number | null
  sus: number[] | null
  open: Record<string, string>
  profile: Record<string, string>
  /** Minutos gastos em cada tarefa (desde a conclusão anterior ou o aceite); null = não concluída. */
  taskMinutes: Record<string, number | null>
  taskMethods: Record<string, string | null>
}

export interface StudyResults {
  joined: number
  submitted: number
  sus: { mean: number | null; median: number | null; sd: number | null; min: number | null; max: number | null }
  itemMeans: (number | null)[]
  tasks: {
    key: string
    title: string
    completed: number
    rate: number
    auto: number
    manual: number
    medianMinutes: number | null
  }[]
  profile: { key: string; label: string; counts: Record<string, number> }[]
  participants: ParticipantResult[]
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(value: number | null, digits = 1): number | null {
  if (value === null) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export async function buildStudyResults(studyId: string): Promise<StudyResults> {
  const rows = await tursoDb.studyParticipant.findMany({
    where: { studyId },
    orderBy: { consentAt: "asc" },
    include: { tasks: true },
  });

  const participants: ParticipantResult[] = rows.map((p, i) => {
    const answers: StudyAnswers | null = p.answers ? JSON.parse(p.answers) : null;

    // Tempo de cada tarefa = intervalo desde a conclusão anterior (ou o aceite).
    const done = [...p.tasks].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
    const taskMinutes: Record<string, number | null> = {};
    const taskMethods: Record<string, string | null> = {};
    let previous = p.consentAt.getTime();
    for (const t of done) {
      const minutes = Math.max(0, (t.completedAt.getTime() - previous) / 60000);
      taskMinutes[t.taskKey] = round(minutes);
      taskMethods[t.taskKey] = t.method;
      previous = Math.max(previous, t.completedAt.getTime());
    }
    for (const t of STUDY_TASKS) {
      if (!(t.key in taskMinutes)) {
        taskMinutes[t.key] = null;
        taskMethods[t.key] = null;
      }
    }

    return {
      id: p.id,
      label: `P${String(i + 1).padStart(2, "0")}`,
      consentAt: p.consentAt.toISOString(),
      submittedAt: p.submittedAt?.toISOString() ?? null,
      susScore: p.susScore,
      sus: answers?.sus ?? null,
      open: answers?.open ?? {},
      profile: answers?.profile ?? {},
      taskMinutes,
      taskMethods,
    };
  });

  const scores = participants.map((p) => p.susScore).filter((s): s is number => s !== null);
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const sd =
    scores.length > 1 && mean !== null
      ? Math.sqrt(scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / (scores.length - 1))
      : null;

  const answered = participants.filter((p) => p.sus);
  const itemMeans = SUS_ITEMS.map((_, i) =>
    answered.length ? round(answered.reduce((acc, p) => acc + p.sus![i], 0) / answered.length, 2) : null
  );

  const joined = participants.length;
  const tasks = STUDY_TASKS.map((t) => {
    const minutes = participants.map((p) => p.taskMinutes[t.key]).filter((m): m is number => m !== null);
    const methods = participants.map((p) => p.taskMethods[t.key]);
    return {
      key: t.key,
      title: t.title,
      completed: minutes.length,
      rate: joined ? Math.round((minutes.length / joined) * 100) : 0,
      auto: methods.filter((m) => m === "auto").length,
      manual: methods.filter((m) => m === "manual").length,
      medianMinutes: round(median(minutes)),
    };
  });

  const profile = PROFILE_QUESTIONS.map((q) => {
    const counts: Record<string, number> = {};
    for (const p of participants) {
      const value = p.profile[q.key];
      if (value) counts[value] = (counts[value] ?? 0) + 1;
    }
    return { key: q.key, label: q.label, counts };
  });

  return {
    joined,
    submitted: scores.length,
    sus: {
      mean: round(mean),
      median: round(median(scores)),
      sd: round(sd),
      min: scores.length ? Math.min(...scores) : null,
      max: scores.length ? Math.max(...scores) : null,
    },
    itemMeans,
    tasks,
    profile,
    participants,
  };
}
