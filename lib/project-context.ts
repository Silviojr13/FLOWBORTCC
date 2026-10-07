import { tursoDb } from "./turso-db";
import { formatDate, isTaskOverdue } from "./kanban";
import { DEV_NOTE_LABELS, isDevNoteKind } from "./dev-notes";
import { ROLE_LABELS, isMemberRole } from "./project-permissions";

// Monta um resumo textual do estado atual do projeto para ser injetado no prompt do
// assistente. É o que permite ao FlowBot responder sobre "este projeto" em vez de falar
// genericamente sobre robótica.
// O texto respeita um orçamento de caracteres (`maxChars`): o plano gratuito da IA aceita
// poucos tokens por minuto, e um projeto grande, listado por inteiro, sozinho passaria dele.
// O andamento registrado pelo Claude Code (aba Desenvolvimento) entra no fim: é com ele que
// o assistente acompanha o que já foi desenvolvido.
export async function buildProjectContext(
  projectId: string,
  userId: string,
  maxChars = 4500,
  { hideCosts = false, devNotes = 5 }: { hideCosts?: boolean; devNotes?: number } = {}
): Promise<string | null> {
  const project = await tursoDb.project.findUnique({
    where: { id: projectId, userId },
    select: {
      id: true,
      name: true,
      description: true,
      startDate: true,
      endDate: true,
      user: { select: { name: true } },
      members: { orderBy: { createdAt: "asc" }, select: { role: true, user: { select: { name: true } } } },
    },
  });
  if (!project) return null;

  const [requirements, features, components, columns, tasks, sprints, notes] = await Promise.all([
    tursoDb.requirement.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
    tursoDb.feature.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    tursoDb.hardwareComponent.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { requirement: { select: { code: true } } },
    }),
    tursoDb.kanbanColumn.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    tursoDb.task.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }],
      include: {
        column: { select: { name: true, isDone: true } },
        requirement: { select: { code: true } },
        feature: { select: { name: true } },
        sprint: { select: { name: true } },
        participants: { select: { name: true }, orderBy: { order: "asc" } },
      },
    }),
    tursoDb.sprint.findMany({ where: { projectId }, orderBy: { startDate: "asc" } }),
    devNotes > 0
      ? tursoDb.devNote.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          take: devNotes,
          include: { task: { select: { title: true } } },
        })
      : Promise.resolve([]),
  ]);

  const totalCost = components.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);
  const tasksDone = tasks.filter((t) => t.column.isDone).length;
  const overdue = tasks.filter((t) =>
    isTaskOverdue({ dueDate: t.dueDate?.toISOString() ?? null }, t.column.isDone)
  ).length;
  const covered = new Set(tasks.map((t) => t.requirementId).filter(Boolean));
  const uncovered = requirements.filter((r) => !covered.has(r.id)).map((r) => r.code);

  const lines: string[] = [];
  lines.push(`Projeto: "${project.name}"`);
  if (project.description) lines.push(`Descricao: ${project.description}`);
  if (project.startDate || project.endDate) {
    lines.push(`Cronograma: ${formatDate(project.startDate)} a ${formatDate(project.endDate)}`);
  }
  lines.push(
    `Resumo: ${requirements.length} requisito(s), ${features.length} funcionalidade(s), ${tasks.length} tarefa(s) (${tasksDone} concluidas, ${overdue} atrasadas), ${sprints.length} sprint(s), ${components.length} componente(s)${hideCosts ? "" : `, custo estimado R$ ${totalCost.toFixed(2)}`}.`
  );
  if (uncovered.length > 0) {
    lines.push(`Requisitos sem tarefa vinculada: ${uncovered.join(", ")}.`);
  }
  // A equipe de verdade: sem ela, a IA tomava "Claude Code" (a origem do andamento) por
  // uma pessoa e designava tarefas a ele.
  // Nomes salvos com espaço sobrando ("Rafaela ") viravam "Rafaela  (Visitante)".
  const cleanName = (name: string | null) => name?.replace(/\s+/g, " ").trim() || null;
  const ownerName = cleanName(project.user.name);
  const team = [
    ownerName ? `${ownerName} (${ROLE_LABELS.dono})` : null,
    ...project.members.flatMap((m) => {
      const name = cleanName(m.user.name);
      return name ? [`${name} (${isMemberRole(m.role) ? ROLE_LABELS[m.role] : m.role})`] : [];
    }),
  ].filter(Boolean);
  lines.push(
    `Equipe (unicos nomes validos como responsavel ou participante): ${team.join(", ") || "(sem nomes cadastrados)"}. O Claude Code, que registra o andamento, e uma ferramenta, nao um membro.`
  );

  const header = lines.join("\n");

  const requirementLines = (max: number) =>
    requirements.length === 0
      ? ["- (nenhum cadastrado)"]
      : requirements.map(
          (r) =>
            `- ${r.code} [${r.category}, ${r.priority}, ${r.status}${r.level ? `, ${r.level}` : ""}]: ${clip(r.description, max)}`
        );

  const featureLines = (max: number) =>
    features.length === 0
      ? ["- (nenhuma cadastrada)"]
      : features.map((f) => `- ${f.name} [${f.status}]${f.description && max > 0 ? `: ${clip(f.description, max)}` : ""}`);

  // Tarefas abertas com os detalhes (é sobre elas que se pergunta e se age); concluídas só
  // pelo título, para o contexto caber no limite de tokens da IA.
  const openTasks = tasks.filter((t) => !t.column.isDone);
  const doneTasks = tasks.filter((t) => t.column.isDone);
  const openTaskLines = (limit: number) => {
    const shown = openTasks.slice(0, limit).map((t) => {
      const meta = [
        t.column.name,
        t.priority,
        t.assignee ? `resp. ${t.assignee}` : null,
        t.participants.length ? `com ${t.participants.map((p) => p.name).join(", ")}` : null,
        t.dueDate ? `prazo ${formatDate(t.dueDate)}` : null,
        t.requirement?.code ?? null,
        t.sprint ? t.sprint.name : null,
      ].filter(Boolean);
      return `- "${t.title}" [${meta.join(", ")}]`;
    });
    if (openTasks.length > limit) shown.push(`- (+${openTasks.length - limit} tarefa(s) aberta(s) omitida(s))`);
    return shown.length > 0 ? shown : ["- (nenhuma)"];
  };
  const doneTaskLine = (withTitles: boolean) =>
    doneTasks.length === 0
      ? "- (nenhuma)"
      : withTitles
        ? `- ${doneTasks.map((t) => `"${t.title}"`).join("; ")}`
        : `- ${doneTasks.length} tarefa(s) concluida(s) (titulos omitidos para caber no limite)`;

  const sprintLines =
    sprints.length === 0
      ? ["- (nenhuma planejada)"]
      : sprints.map((sp) => {
          const count = tasks.filter((t) => t.sprintId === sp.id).length;
          return `- "${sp.name}" (${formatDate(sp.startDate)} a ${formatDate(sp.endDate)}), ${count} tarefa(s)`;
        });

  const componentLines =
    components.length === 0
      ? ["- (nenhum cadastrado)"]
      : components.map(
          (c) =>
            `- ${c.name} x${c.quantity}${hideCosts ? "" : ` a R$ ${c.unitPrice.toFixed(2)}`}${c.requirement ? ` (${c.requirement.code})` : ""}`
        );

  // Do mais recente ao mais antigo, como chegou do banco.
  const noteLines = notes.map((n) => {
    const kind = isDevNoteKind(n.kind) ? DEV_NOTE_LABELS[n.kind] : n.kind;
    const task = n.task ? ` (tarefa "${n.task.title}")` : "";
    return `- ${formatDate(n.createdAt)} ${n.source} · ${kind}${task}: ${clip(n.message, 220)}`;
  });

  const assemble = (o: { reqMax: number; featMax: number; openLimit: number; doneTitles: boolean }) =>
    [
      header,
      "",
      "REQUISITOS:",
      ...requirementLines(o.reqMax),
      "",
      "FUNCIONALIDADES:",
      ...featureLines(o.featMax),
      "",
      `COLUNAS DO KANBAN: ${columns.map((c) => c.name).join(" | ") || "(nenhuma)"}`,
      `TAREFAS ABERTAS (${openTasks.length}):`,
      ...openTaskLines(o.openLimit),
      `TAREFAS CONCLUIDAS (${doneTasks.length}):`,
      doneTaskLine(o.doneTitles),
      "",
      "SPRINTS:",
      ...sprintLines,
      "",
      "COMPONENTES:",
      ...componentLines,
      ...(noteLines.length > 0 ? ["", "ANDAMENTO DO DESENVOLVIMENTO (mais recente primeiro):", ...noteLines] : []),
    ].join("\n");

  // Do mais completo ao mais enxuto, até caber no orçamento de caracteres.
  const levels = [
    { reqMax: 160, featMax: 100, openLimit: 60, doneTitles: true },
    { reqMax: 120, featMax: 0, openLimit: 40, doneTitles: false },
    { reqMax: 80, featMax: 0, openLimit: 20, doneTitles: false },
    { reqMax: 50, featMax: 0, openLimit: 10, doneTitles: false },
  ];
  for (const level of levels) {
    const text = assemble(level);
    if (text.length <= maxChars) return text;
  }
  return `${assemble(levels[levels.length - 1]).slice(0, maxChars)}\n(contexto resumido para caber no limite)`;
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
