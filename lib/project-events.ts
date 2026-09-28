import { tursoDb } from "./turso-db";

/**
 * Barramento de eventos do projeto (padrão Observer).
 *
 * Os módulos de Requisitos, Kanban e Custos não se conhecem: quando algo muda, a rota
 * publica um evento e os observadores registrados aqui reagem de forma independente,
 * devolvendo "efeitos" — mensagens e sugestões que a interface mostra ao usuário.
 * É o que faz uma alteração em um módulo repercutir nos outros (Sprint 2).
 */

export type ProjectEvent =
  | {
      type: "requirement.status_changed";
      projectId: string;
      requirementId: string;
      code: string;
      from: string;
      to: string;
    }
  | {
      type: "requirement.deleted";
      projectId: string;
      requirementId: string;
      code: string;
    }
  | {
      type: "task.moved";
      projectId: string;
      taskId: string;
      taskTitle: string;
      requirementId: string | null;
      toColumnIsDone: boolean;
    };

/** Repercussão de um evento, exibida na interface após a operação. */
export interface ProjectEffect {
  /** Identifica o tipo de repercussão para a interface decidir como exibir. */
  kind:
    | "tasks_of_discarded_requirement"
    | "tasks_of_restored_requirement"
    | "requirement_fully_covered"
    | "links_removed";
  /** Texto pronto para exibição (toast ou alerta). */
  message: string;
  /** Severidade sugerida. */
  level: "info" | "warning" | "success";
  /** Dados para ações contextuais (por exemplo, botão "Validar requisito"). */
  data?: Record<string, unknown>;
}

type Observer = (event: ProjectEvent) => Promise<ProjectEffect[]>;

const plural = (n: number, singular: string, plural_: string) =>
  `${n} ${n === 1 ? singular : plural_}`;

/**
 * Requisito descartado: as tarefas ainda abertas que dependiam dele viram pendência.
 * É o exemplo citado no plano de sprints — mudar o status de um requisito repercute no Kanban.
 */
const discardedRequirementObserver: Observer = async (event) => {
  if (event.type !== "requirement.status_changed") return [];
  if (event.to !== "Descartado" || event.from === "Descartado") return [];

  const tasks = await tursoDb.task.findMany({
    where: { requirementId: event.requirementId, column: { isDone: false } },
    select: { id: true, title: true },
  });

  if (tasks.length === 0) return [];

  return [
    {
      kind: "tasks_of_discarded_requirement",
      level: "warning",
      message: `${event.code} foi descartado, mas ${plural(tasks.length, "tarefa continua aberta", "tarefas continuam abertas")} no Kanban.`,
      data: { requirementCode: event.code, tasks },
    },
  ];
};

/** Requisito saiu de "Descartado": as tarefas voltam a valer. */
const restoredRequirementObserver: Observer = async (event) => {
  if (event.type !== "requirement.status_changed") return [];
  if (event.from !== "Descartado" || event.to === "Descartado") return [];

  const count = await tursoDb.task.count({
    where: { requirementId: event.requirementId, column: { isDone: false } },
  });

  if (count === 0) return [];

  return [
    {
      kind: "tasks_of_restored_requirement",
      level: "info",
      message: `${event.code} voltou para "${event.to}"; ${plural(count, "tarefa aberta volta", "tarefas abertas voltam")} a valer no Kanban.`,
      data: { requirementCode: event.code },
    },
  ];
};

/**
 * Todas as tarefas de um requisito concluídas: sugere validar o requisito.
 * A mudança não é automática — quem decide é o usuário.
 */
const requirementCoverageObserver: Observer = async (event) => {
  if (event.type !== "task.moved") return [];
  if (!event.toColumnIsDone || !event.requirementId) return [];

  const [requirement, total, done] = await Promise.all([
    tursoDb.requirement.findUnique({
      where: { id: event.requirementId },
      select: { id: true, code: true, status: true },
    }),
    tursoDb.task.count({ where: { requirementId: event.requirementId } }),
    tursoDb.task.count({
      where: { requirementId: event.requirementId, column: { isDone: true } },
    }),
  ]);

  if (!requirement || total === 0 || done < total) return [];
  if (requirement.status === "Validado" || requirement.status === "Descartado") return [];

  return [
    {
      kind: "requirement_fully_covered",
      level: "success",
      message:
        total === 1
          ? `A única tarefa de ${requirement.code} foi concluída. Deseja marcar o requisito como Validado?`
          : `As ${total} tarefas de ${requirement.code} estão concluídas. Deseja marcar o requisito como Validado?`,
      data: { requirementId: requirement.id, requirementCode: requirement.code },
    },
  ];
};

/** Requisito excluído: avisa o que ficou sem vínculo (as FKs viram null silenciosamente). */
const removedLinksObserver: Observer = async (event) => {
  if (event.type !== "requirement.deleted") return [];

  const [tasks, features, components] = await Promise.all([
    tursoDb.task.count({ where: { requirementId: null, projectId: event.projectId } }),
    tursoDb.feature.count({ where: { requirementId: null, projectId: event.projectId } }),
    tursoDb.hardwareComponent.count({
      where: { requirementId: null, projectId: event.projectId },
    }),
  ]);

  const parts = [
    tasks > 0 ? plural(tasks, "tarefa", "tarefas") : null,
    features > 0 ? plural(features, "funcionalidade", "funcionalidades") : null,
    components > 0 ? plural(components, "componente", "componentes") : null,
  ].filter(Boolean);

  if (parts.length === 0) return [];

  return [
    {
      kind: "links_removed",
      level: "info",
      message: `${event.code} foi excluído. O projeto tem ${parts.join(", ")} sem requisito vinculado.`,
      data: { requirementCode: event.code },
    },
  ];
};

const observers: Observer[] = [
  discardedRequirementObserver,
  restoredRequirementObserver,
  requirementCoverageObserver,
  removedLinksObserver,
];

/**
 * Publica um evento e devolve as repercussões. Uma falha em um observador não derruba a
 * operação principal, que já foi concluída quando o evento é emitido.
 */
export async function emitProjectEvent(event: ProjectEvent): Promise<ProjectEffect[]> {
  const settled = await Promise.allSettled(observers.map((observe) => observe(event)));

  return settled.flatMap((result) => {
    if (result.status === "fulfilled") return result.value;
    console.error("Observador de evento do projeto falhou:", result.reason);
    return [];
  });
}
