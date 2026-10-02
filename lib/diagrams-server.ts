import { tursoDb } from "./turso-db";
import { getDiagramType } from "./diagrams";

/**
 * Motor de diagramas do FlowBot.
 *
 * Dois caminhos:
 * - "dados": rastreabilidade e cronograma são montados direto do banco, então refletem
 *   exatamente o estado do projeto;
 * - "ia": C4, modelo relacional e UML são escritos pelo modelo de linguagem a partir do
 *   contexto do projeto, seguindo um gabarito de sintaxe Mermaid por tipo.
 */

export class DiagramGenerationError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Utilitários de texto Mermaid                                         */
/* ------------------------------------------------------------------ */

/** Texto seguro dentro de um rótulo entre aspas do Mermaid. */
function label(text: string, max = 48): string {
  const clean = text.replace(/["`]/g, "'").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Nome de tarefa no Gantt: ":" e ";" quebram a sintaxe, "#" inicia entidade. */
function ganttName(text: string): string {
  return label(text, 60).replace(/[:;#]/g, " ").replace(/\s+/g, " ").trim();
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Diagramas montados a partir dos dados                                */
/* ------------------------------------------------------------------ */

async function buildTraceability(projectId: string): Promise<string> {
  const [requirements, features, components, tasks] = await Promise.all([
    tursoDb.requirement.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
    tursoDb.feature.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    tursoDb.hardwareComponent.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    tursoDb.task.findMany({
      where: { projectId },
      select: { requirementId: true, column: { select: { isDone: true } } },
    }),
  ]);

  if (requirements.length === 0) {
    throw new DiagramGenerationError(
      "Cadastre ao menos um requisito para gerar a rastreabilidade.",
      422
    );
  }

  const reqNode = new Map(requirements.map((r, i) => [r.id, `R${i}`]));
  const lines: string[] = ["flowchart LR"];

  lines.push('  subgraph FUNC["Funcionalidades"]');
  features.forEach((f, i) => lines.push(`    F${i}["${label(f.name, 36)}"]`));
  if (features.length === 0) lines.push('    F_vazio["Nenhuma cadastrada"]');
  lines.push("  end");

  lines.push('  subgraph REQ["Requisitos"]');
  requirements.forEach((r) => {
    lines.push(`    ${reqNode.get(r.id)}["${r.code}: ${label(r.description, 44)}"]`);
  });
  lines.push("  end");

  lines.push('  subgraph EXEC["Execução"]');
  const taskLines: string[] = [];
  requirements.forEach((r, i) => {
    const linked = tasks.filter((t) => t.requirementId === r.id);
    if (linked.length === 0) return;
    const done = linked.filter((t) => t.column.isDone).length;
    taskLines.push(`    T${i}["${linked.length} tarefa(s) · ${done} concluída(s)"]`);
  });
  lines.push(...(taskLines.length ? taskLines : ['    T_vazio["Nenhuma tarefa vinculada"]']));
  components.forEach((c, i) => {
    lines.push(`    C${i}["${label(c.name, 32)} x${c.quantity}"]`);
  });
  lines.push("  end");

  features.forEach((f, i) => {
    const target = f.requirementId ? reqNode.get(f.requirementId) : null;
    if (target) lines.push(`  F${i} -->|atende| ${target}`);
  });
  requirements.forEach((r, i) => {
    if (tasks.some((t) => t.requirementId === r.id)) {
      lines.push(`  ${reqNode.get(r.id)} -->|implementado por| T${i}`);
    }
  });
  components.forEach((c, i) => {
    const source = c.requirementId ? reqNode.get(c.requirementId) : null;
    if (source) lines.push(`  ${source} -->|usa| C${i}`);
  });

  // Destaques: requisito sem tarefa (lacuna de cobertura) e requisito já validado.
  lines.push("  classDef semCobertura stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 3");
  lines.push("  classDef validado stroke:#16a34a,stroke-width:2px");
  const uncovered = requirements.filter((r) => !tasks.some((t) => t.requirementId === r.id));
  const validated = requirements.filter(
    (r) => r.status === "Validado" && tasks.some((t) => t.requirementId === r.id)
  );
  if (uncovered.length) {
    lines.push(`  class ${uncovered.map((r) => reqNode.get(r.id)).join(",")} semCobertura`);
  }
  if (validated.length) {
    lines.push(`  class ${validated.map((r) => reqNode.get(r.id)).join(",")} validado`);
  }

  return lines.join("\n");
}

async function buildGantt(projectId: string, projectName: string): Promise<string> {
  const [sprints, tasks] = await Promise.all([
    tursoDb.sprint.findMany({ where: { projectId }, orderBy: { startDate: "asc" } }),
    tursoDb.task.findMany({
      where: { projectId, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      take: 80,
      select: {
        title: true,
        dueDate: true,
        sprintId: true,
        column: { select: { isDone: true } },
      },
    }),
  ]);

  if (sprints.length === 0 && tasks.length === 0) {
    throw new DiagramGenerationError(
      "Planeje uma sprint ou defina prazos nas tarefas para gerar o cronograma.",
      422
    );
  }

  const today = isoDay(new Date());
  const lines = [
    "gantt",
    `  title ${ganttName(projectName)}`,
    "  dateFormat YYYY-MM-DD",
    "  axisFormat %d/%m",
  ];

  if (sprints.length) {
    lines.push("  section Sprints");
    for (const s of sprints) {
      const start = isoDay(s.startDate);
      const end = isoDay(s.endDate);
      const state = end < today ? "done, " : start <= today ? "active, " : "";
      lines.push(`  ${ganttName(s.name)} :${state}${start}, ${end}`);
    }
  }

  // Tarefas agrupadas pela sprint; cada uma aparece como um marco de um dia no prazo.
  const groups = [
    ...sprints.map((s) => ({ name: s.name, id: s.id as string | null })),
    { name: "Sem sprint", id: null },
  ];
  for (const group of groups) {
    const inGroup = tasks.filter((t) => t.sprintId === group.id);
    if (inGroup.length === 0) continue;
    lines.push(`  section ${ganttName(group.name)}`);
    for (const t of inGroup) {
      const due = isoDay(t.dueDate!);
      const state = t.column.isDone ? "done, " : due < today ? "crit, " : "";
      lines.push(`  ${ganttName(t.title)} :${state}${due}, 1d`);
    }
  }

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Diagramas escritos pela IA                                           */
/* ------------------------------------------------------------------ */

// Gabarito de sintaxe por tipo: o modelo erra bem menos quando vê exatamente a forma esperada.
const SYNTAX_GUIDES: Record<string, string> = {
  "c4-context": `Use o diagrama C4 de Contexto do Mermaid. Formato exato:
C4Context
  title Contexto do sistema - <nome>
  Person(operador, "Operador", "Quem usa o sistema")
  System(sistema, "<Nome do sistema>", "O que o sistema faz")
  System_Ext(externo, "<Sistema externo>", "Papel do sistema externo")
  Rel(operador, sistema, "Usa", "Interface")
  Rel(sistema, externo, "Envia dados", "MQTT")
Inclua todas as pessoas (atores) e sistemas externos relevantes. Nao detalhe o interior do sistema.
Tudo o que a equipe constroi (firmware, aplicativo, painel web, API) faz parte do System; System_Ext e so para sistemas de terceiros (servicos de nuvem, APIs externas, sistemas legados).`,

  "c4-container": `Use o diagrama C4 de Conteineres do Mermaid. Formato exato:
C4Container
  title Conteineres - <nome>
  Person(operador, "Operador", "Descricao")
  System_Boundary(limite, "<Nome do sistema>") {
    Container(app, "Aplicacao Web", "Next.js", "Responsabilidade")
    Container(firmware, "Firmware", "C++ / ESP32", "Responsabilidade")
    ContainerDb(banco, "Banco de dados", "PostgreSQL", "O que guarda")
  }
  System_Ext(externo, "<Sistema externo>", "Descricao")
  Rel(operador, app, "Usa", "HTTPS")
  Rel(app, banco, "Le e grava", "SQL")
Em projetos embarcados, firmware, microcontroladores, gateways e aplicativos de supervisao sao conteineres. Indique a tecnologia de cada um.`,

  "c4-component": `Use o diagrama C4 de Componentes do Mermaid. Formato exato:
C4Component
  title Componentes - <conteiner detalhado>
  Container(externo, "Conteiner vizinho", "Tecnologia", "Descricao")
  Container_Boundary(limite, "<Conteiner detalhado>") {
    Component(modulo1, "Nome do modulo", "Tecnologia", "Responsabilidade")
    Component(modulo2, "Nome do modulo", "Tecnologia", "Responsabilidade")
  }
  Rel(modulo1, modulo2, "Chama", "Funcao")
Se o usuario nao indicar o conteiner, detalhe o principal (o firmware em projetos embarcados).`,

  er: `Use erDiagram do Mermaid. Formato exato:
erDiagram
  USUARIO ||--o{ PROJETO : possui
  PROJETO ||--|{ REQUISITO : contem
  USUARIO {
    string id PK
    string nome
    datetime criado_em
  }
  PROJETO {
    string id PK
    string usuario_id FK
    string nome
  }
Nomes de entidades em MAIUSCULAS, sem acentos e sem espacos (use _). Tipos de uma palavra: string, int, float, boolean, date, datetime. Marque PK e FK. Use cardinalidades ||--o{, ||--|{, ||--||, }o--o{.`,

  class: `Use classDiagram do Mermaid. Formato exato:
classDiagram
  class ControladorMotor {
    -int velocidadeAtual
    +definirVelocidade(int rpm) void
    +parar() void
  }
  class Sensor {
    <<interface>>
    +ler() float
  }
  Sensor <|.. SensorUltrassonico
  Robo *-- ControladorMotor
  Robo --> Sensor : consulta
Nomes de classes e membros sem acentos e sem espacos. Use visibilidade (+ - #), tipos e as relacoes <|-- (heranca), <|.. (realizacao), *-- (composicao), o-- (agregacao), --> (associacao).`,

  "use-case": `O Mermaid nao tem diagrama de casos de uso nativo: represente com flowchart. Formato exato:
flowchart LR
  operador(["Operador"])
  tecnico(["Tecnico"])
  subgraph sistema["<Nome do sistema>"]
    uc1(["Iniciar separacao"])
    uc2(["Parar em emergencia"])
    uc3(["Consultar historico"])
  end
  operador --- uc1
  operador --- uc2
  tecnico --- uc3
  uc1 -.->|inclui| uc3
Atores fora do subgraph, casos de uso dentro. Cada caso de uso comeca com verbo no infinitivo e deriva dos requisitos funcionais. Identificadores sem acentos.`,

  sequence: `Use sequenceDiagram do Mermaid. Formato exato:
sequenceDiagram
  actor operador as Operador
  participant app as Aplicacao
  participant mcu as Microcontrolador
  operador->>app: Inicia o ciclo
  app->>mcu: Envia comando
  alt Peca detectada
    mcu-->>app: Confirma posicao
  else Falha no sensor
    mcu-->>app: Retorna erro
  end
  loop A cada leitura
    mcu->>mcu: Le o sensor
  end
Identificadores sem acentos. Nas mensagens nao use ponto e virgula nem o caractere #.`,

  state: `Use stateDiagram-v2 do Mermaid. Formato exato:
stateDiagram-v2
  [*] --> Ocioso
  Ocioso --> Operando : comando iniciar
  Operando --> Pausado : comando pausar
  Pausado --> Operando : comando retomar
  Operando --> Emergencia : botao de emergencia
  Emergencia --> Ocioso : reset manual
  Operando --> [*] : desligar
  state "Em emergencia" as Emergencia
Nomes de estados sem acentos e sem espacos (use state "Rotulo" as Nome para rotulos com espaco).`,
};

const C4_PARENT: Record<string, string> = {
  "c4-container": "c4-context",
  "c4-component": "c4-container",
};

const BASE_RULES = `Voce e um arquiteto de software especialista em engenharia de software e sistemas embarcados.
Sua tarefa e produzir UM diagrama em codigo Mermaid para o projeto descrito.

REGRAS OBRIGATORIAS:
- Responda SOMENTE com o codigo Mermaid. Sem cercas de codigo, sem explicacoes, sem comentarios antes ou depois.
- A primeira linha deve ser a palavra-chave do diagrama.
- Rotulos e descricoes em portugues brasileiro; identificadores sem acentos e sem espacos.
- Nunca use aspas duplas dentro de um rotulo.
- Baseie-se no contexto do projeto (requisitos, funcionalidades, componentes e tarefas). Quando algo nao estiver descrito, infira a solucao tecnica mais provavel para esse tipo de projeto, sem inventar fatos que contradigam o contexto.
- Seja completo, mas legivel: no maximo cerca de 25 elementos.`;

function cleanModelOutput(raw: string): string {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  // Descarta qualquer frase antes da palavra-chave do diagrama.
  const keyword = text.search(
    /^(C4Context|C4Container|C4Component|erDiagram|classDiagram|flowchart|graph|sequenceDiagram|stateDiagram-v2|stateDiagram|gantt)\b/m
  );
  if (keyword > 0) text = text.slice(keyword);
  return text.trim();
}

/**
 * Contexto enxuto para diagramas: o que define a arquitetura (requisitos, funcionalidades,
 * componentes) e só os títulos das tarefas. O contexto completo do chat gasta tokens demais
 * para o limite por minuto do plano gratuito do Groq.
 */
async function buildDiagramContext(projectId: string, userId: string): Promise<string | null> {
  const project = await tursoDb.project.findUnique({
    where: { id: projectId, userId },
    select: { name: true, description: true },
  });
  if (!project) return null;

  const [requirements, features, components, tasks] = await Promise.all([
    tursoDb.requirement.findMany({
      where: { projectId, status: { not: "Descartado" } },
      orderBy: { code: "asc" },
      select: { code: true, category: true, level: true, description: true },
    }),
    tursoDb.feature.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      select: { name: true, description: true },
    }),
    tursoDb.hardwareComponent.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      select: { name: true, description: true, quantity: true },
    }),
    tursoDb.task.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: { title: true },
    }),
  ]);

  const lines = [`Projeto: ${project.name}`];
  if (project.description) lines.push(`Descricao: ${project.description}`);
  lines.push("", "REQUISITOS:");
  for (const r of requirements) {
    lines.push(`- ${r.code} (${r.category}${r.level ? `, ${r.level}` : ""}): ${r.description}`);
  }
  if (features.length) {
    lines.push("", "FUNCIONALIDADES:");
    for (const f of features) lines.push(`- ${f.name}${f.description ? `: ${f.description}` : ""}`);
  }
  if (components.length) {
    lines.push("", "COMPONENTES:");
    for (const c of components) {
      lines.push(`- ${c.name} x${c.quantity}${c.description ? `: ${c.description}` : ""}`);
    }
  }
  if (tasks.length) {
    lines.push("", `TAREFAS: ${tasks.map((t) => t.title).join("; ")}`);
  }
  return lines.join("\n").slice(0, 9000);
}

/** Espera pedida pelo Groq ao atingir o limite por minuto (cabeçalho retry-after). */
function retryAfterMs(res: Response): number | null {
  const seconds = Number(res.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

async function callModel(system: string, user: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new DiagramGenerationError("GROQ_API_KEY não configurada no servidor.", 503);
  const model = process.env.GROQ_MODEL_NAME || "qwen/qwen3.8-27b";

  const body = {
    model,
    max_tokens: 2500,
    temperature: 0.2,
    // O raciocínio do modelo fica fora da resposta: só o código volta.
    reasoning_format: "hidden",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
    } catch {
      if (attempt === 3) throw new DiagramGenerationError("Não foi possível conectar à IA.", 503);
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const content: string = data.choices?.[0]?.message?.content ?? "";
      const code = cleanModelOutput(content);
      if (!code) throw new DiagramGenerationError("A IA não devolveu um diagrama. Tente de novo.");
      return code;
    }

    if (res.status === 429) {
      // O limite do plano gratuito é por minuto: vale esperar quando a espera é curta.
      const wait = retryAfterMs(res);
      if (wait !== null && wait <= 30_000 && attempt < 3) {
        await new Promise((r) => setTimeout(r, wait + 500));
        continue;
      }
      throw new DiagramGenerationError("Limite de uso da IA atingido. Tente em instantes.", 429);
    }
    if (!(res.status >= 500 && attempt < 3)) {
      console.error("[diagramas] Erro da IA:", res.status, await res.text());
      throw new DiagramGenerationError("A IA não conseguiu gerar o diagrama agora.");
    }
  }
  throw new DiagramGenerationError("A IA não conseguiu gerar o diagrama agora.");
}

export interface GenerateOptions {
  type: string;
  projectId: string;
  userId: string;
  instructions?: string;
  /** Código que falhou ao renderizar e a mensagem de erro do Mermaid: modo correção. */
  repair?: { code: string; error: string };
}

export async function generateDiagram(
  options: GenerateOptions
): Promise<{ code: string; source: "ia" | "dados" }> {
  const info = getDiagramType(options.type);
  if (!info) throw new DiagramGenerationError("Tipo de diagrama desconhecido.", 400);

  if (info.engine === "dados") {
    const project = await tursoDb.project.findUnique({
      where: { id: options.projectId },
      select: { name: true },
    });
    const code =
      info.key === "traceability"
        ? await buildTraceability(options.projectId)
        : await buildGantt(options.projectId, project?.name ?? "Projeto");
    return { code, source: "dados" };
  }

  const context = await buildDiagramContext(options.projectId, options.userId);
  if (!context) throw new DiagramGenerationError("Projeto não encontrado.", 404);

  const system = `${BASE_RULES}\n\nTIPO DE DIAGRAMA: ${info.label} — ${info.description}\n\n${SYNTAX_GUIDES[info.key]}`;

  let user = `CONTEXTO DO PROJETO:\n${context}`;
  if (options.instructions?.trim()) {
    user += `\n\nINSTRUCOES DO USUARIO: ${options.instructions.trim().slice(0, 500)}`;
  }
  // Níveis do C4 se refinam: o nível acima já salvo serve de referência para os nomes e
  // fronteiras não mudarem de um diagrama para o outro.
  const parentLevel = C4_PARENT[info.key];
  if (parentLevel && !options.repair) {
    const parent = await tursoDb.diagram.findFirst({
      where: { projectId: options.projectId, type: parentLevel },
      orderBy: { updatedAt: "desc" },
      select: { code: true },
    });
    if (parent) {
      user += `\n\nDIAGRAMA DO NIVEL ANTERIOR (mantenha os mesmos nomes, atores e fronteiras):\n${parent.code.slice(0, 3000)}`;
    }
  }

  if (options.repair) {
    user += `\n\nO codigo abaixo falhou ao ser desenhado pelo Mermaid. Corrija a sintaxe mantendo o mesmo conteudo e devolva apenas o codigo corrigido.\nERRO: ${options.repair.error.slice(0, 600)}\nCODIGO:\n${options.repair.code.slice(0, 6000)}`;
  } else {
    user += `\n\nGere o diagrama "${info.label}" deste projeto.`;
  }

  return { code: await callModel(system, user), source: "ia" };
}
