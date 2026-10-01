import { tursoDb } from "./turso-db";
import { DEFAULT_KANBAN_COLUMNS } from "./kanban";
import { DEMO_CHAT_FULL } from "./tour-chat-script";

/**
 * Projeto de exemplo do tour guiado.
 *
 * O sistema cria este projeto sozinho na primeira sessão para que o usuário veja a
 * plataforma preenchida — com requisitos, funcionalidades, componentes, tarefas em
 * colunas diferentes e uma sprint em andamento — em vez de telas vazias.
 */

const TUTORIAL_PROJECT = {
  name: "Braço Robótico — Projeto guiado",
  description:
    "Projeto de exemplo criado automaticamente para o seu tour. Um braço robótico de 3 eixos para separar peças por cor em uma esteira. Explore à vontade: você pode editar ou excluir tudo depois.",
};

const REQUIREMENTS = [
  {
    description: "O braço deve posicionar a garra em qualquer ponto da área de trabalho de 30 x 30 cm.",
    category: "Funcional",
    priority: "Alta",
    status: "Validado",
    level: "Sistema",
  },
  {
    description: "O sistema deve identificar a cor da peça na esteira antes de acioná-la.",
    category: "Funcional",
    priority: "Alta",
    status: "Validado",
    level: "Subsistema",
  },
  {
    description: "O operador deve poder parar o braço imediatamente por um botão de emergência.",
    category: "Funcional",
    priority: "Alta",
    status: "Em Aberto",
    level: "Sistema",
  },
  {
    description: "O ciclo completo de separação de uma peça deve levar no máximo 8 segundos.",
    category: "Não Funcional",
    priority: "Média",
    status: "Em Aberto",
    level: "Sistema",
  },
  {
    description: "O custo total dos componentes não deve ultrapassar R$ 600,00.",
    category: "Não Funcional",
    priority: "Média",
    status: "Em Aberto",
    level: "Sistema",
  },
] as const;

const FEATURES = [
  {
    name: "Movimentação do braço",
    description: "Controle dos três servos e cinemática para alcançar as posições da área de trabalho.",
    status: "Em desenvolvimento",
    requirementIndex: 0,
  },
  {
    name: "Visão de cores",
    description: "Leitura do sensor de cor e classificação das peças na esteira.",
    status: "Planejada",
    requirementIndex: 1,
  },
  {
    name: "Segurança",
    description: "Parada de emergência e limites de curso dos servos.",
    status: "Planejada",
    requirementIndex: 2,
  },
] as const;

const COMPONENTS = [
  { name: "Arduino Uno R3", description: "Controlador principal", quantity: 1, unitPrice: 89.9, requirementIndex: 0 },
  { name: "Servo motor MG996R", description: "Eixos da base, ombro e cotovelo", quantity: 3, unitPrice: 42.5, requirementIndex: 0 },
  { name: "Sensor de cor TCS3200", description: "Identificação da cor das peças", quantity: 1, unitPrice: 24.9, requirementIndex: 1 },
  { name: "Botão de emergência NF", description: "Parada imediata do braço", quantity: 1, unitPrice: 18.0, requirementIndex: 2 },
  { name: "Fonte chaveada 5V 5A", description: "Alimentação dos servos", quantity: 1, unitPrice: 55.0, requirementIndex: null },
] as const;

// [título, prioridade, responsável, dias até o prazo, requisito, funcionalidade, coluna]
const TASKS = [
  ["Montar a estrutura do braço e fixar os servos", "Média", "Você", -6, 0, 0, "Concluído"],
  ["Calibrar os ângulos de cada servo", "Alta", "Você", -2, 0, 0, "Concluído"],
  ["Implementar a cinemática inversa", "Alta", "Você", 4, 0, 0, "Em Progresso"],
  ["Ler o sensor de cor e classificar as peças", "Alta", "Você", 7, 1, 1, "Em Progresso"],
  ["Testar o ciclo completo com 10 peças", "Média", "Você", 10, 3, 0, "Em Revisão"],
  ["Instalar o botão de emergência", "Alta", "Você", 12, 2, 2, "Backlog"],
  ["Escrever o guia de montagem", "Baixa", null, null, 4, null, "Backlog"],
] as const;

function addDays(days: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

/**
 * Cria o projeto de exemplo para o usuário. Se já existir um projeto de tutorial dele,
 * devolve o existente em vez de criar outro.
 */
export async function createTutorialProject(userId: string): Promise<string> {
  const existing = await tursoDb.project.findFirst({
    where: { userId, isTutorial: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const project = await tursoDb.project.create({
    data: {
      name: TUTORIAL_PROJECT.name,
      description: TUTORIAL_PROJECT.description,
      origin: "manual",
      isTutorial: true,
      userId,
      startDate: addDays(-14),
      endDate: addDays(30),
    },
  });

  const projectId = project.id;

  // Requisitos com código sequencial por categoria, igual ao fluxo normal.
  const codes = { Funcional: 0, "Não Funcional": 0 } as Record<string, number>;
  const requirementIds: string[] = [];
  for (const r of REQUIREMENTS) {
    const prefix = r.category === "Funcional" ? "RF" : "RNF";
    codes[r.category] += 1;
    const created = await tursoDb.requirement.create({
      data: {
        code: `${prefix}${String(codes[r.category]).padStart(2, "0")}`,
        description: r.description,
        category: r.category,
        priority: r.priority,
        status: r.status,
        level: r.level,
        projectId,
      },
      select: { id: true },
    });
    requirementIds.push(created.id);
  }

  const featureIds: string[] = [];
  for (const f of FEATURES) {
    const created = await tursoDb.feature.create({
      data: {
        name: f.name,
        description: f.description,
        status: f.status,
        projectId,
        requirementId: requirementIds[f.requirementIndex],
      },
      select: { id: true },
    });
    featureIds.push(created.id);
  }

  await tursoDb.hardwareComponent.createMany({
    data: COMPONENTS.map((c) => ({
      name: c.name,
      description: c.description,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      projectId,
      requirementId: c.requirementIndex === null ? null : requirementIds[c.requirementIndex],
    })),
  });

  await tursoDb.kanbanColumn.createMany({
    data: DEFAULT_KANBAN_COLUMNS.map((c, i) => ({
      name: c.name,
      isDone: c.isDone,
      order: i,
      projectId,
    })),
  });
  const columns = await tursoDb.kanbanColumn.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
  });
  const columnByName = new Map(columns.map((c) => [c.name, c]));

  const sprint = await tursoDb.sprint.create({
    data: {
      name: "Sprint 1 — Movimentação",
      goal: "Braço posicionando a garra com precisão em toda a área de trabalho.",
      startDate: addDays(-7),
      endDate: addDays(7),
      projectId,
    },
    select: { id: true },
  });

  const orderByColumn = new Map<string, number>();
  for (const [title, priority, assignee, dueOffset, reqIndex, featIndex, columnName] of TASKS) {
    const column = columnByName.get(columnName)!;
    const order = orderByColumn.get(column.id) ?? 0;
    orderByColumn.set(column.id, order + 1);

    await tursoDb.task.create({
      data: {
        title,
        priority,
        assignee,
        dueDate: dueOffset === null ? null : addDays(dueOffset),
        order,
        columnId: column.id,
        projectId,
        requirementId: requirementIds[reqIndex],
        featureId: featIndex === null ? null : featureIds[featIndex],
        // Só as tarefas em andamento entram na sprint, para o progresso ficar parcial.
        sprintId: columnName === "Backlog" ? null : sprint.id,
        history: { create: { fromColumn: null, toColumn: column.name } },
      },
    });
  }

  // A conversa da demonstração fica ligada ao projeto, como acontece no fluxo real: o
  // assistente flutuante do projeto abre exatamente nela.
  await tursoDb.chat.create({
    data: {
      title: DEMO_CHAT_FULL[0].content.slice(0, 60),
      userId,
      projectId,
      messages: {
        create: DEMO_CHAT_FULL.map((m) => ({ role: m.role, content: m.content })),
      },
    },
  });

  return projectId;
}
