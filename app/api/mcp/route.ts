import { NextRequest } from "next/server";
import { userFromBearer } from "@/lib/api-tokens";
import {
  AI_AGENTS,
  askProjectAi,
  BridgeError,
  createProjectComponent,
  createProjectFeature,
  createProjectRequirement,
  createProjectSprint,
  createProjectTask,
  deleteProjectTask,
  listProjects,
  listProjectTasks,
  moveProjectTask,
  readProject,
  readProjectTask,
  recordProgress,
  updateProjectRequirement,
  updateProjectSprint,
  updateProjectTask,
  type BridgeUser,
} from "@/lib/dev-bridge";
import { DEV_NOTE_KINDS } from "@/lib/dev-notes";

export const runtime = "nodejs";
// acionar_ia espera a resposta inteira da IA.
export const maxDuration = 60;

/**
 * Servidor MCP do FlowBot (Model Context Protocol, transporte HTTP "streamable", sem sessão).
 * É a ponte com o Claude Code: com um token pessoal gerado em "Minhas IAs", ele lê o projeto,
 * gerencia requisitos, funcionalidades, sprints, tarefas e componentes, aciona as IAs do
 * FlowBot e registra o andamento do desenvolvimento, sempre com as permissões do cargo.
 *
 *   claude mcp add --transport http flowbot https://<site>/api/mcp --header "Authorization: Bearer fbt_..."
 *
 * Cada pedido é JSON-RPC 2.0 e recebe a resposta em JSON (sem fluxo SSE).
 */

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_VERSION = SUPPORTED_VERSIONS[0];

const SERVER_INSTRUCTIONS = `FlowBot é a plataforma de gestão do projeto (requisitos, funcionalidades, sprints e Kanban).
Comece por listar_projetos e ler_projeto. Ao desenvolver: mova a tarefa para a coluna de andamento
ao começar e para a de concluídas ao terminar, e registre o que fez, problemas e dúvidas com
registrar_andamento. A equipe e as IAs do FlowBot acompanham o projeto por esses registros.
Para gerir o projeto: criar_requisito e atualizar_requisito, criar_funcionalidade, criar_sprint,
atualizar_sprint, criar_componente, atualizar_tarefa, ler_tarefa e excluir_tarefa. acionar_ia consulta as IAs do
FlowBot com o contexto do projeto; o que elas propõem não é aplicado sozinho.`;

const projectId = { type: "string", description: "Id do projeto (veja listar_projetos)." };
const taskRef = { type: "string", description: "Id da tarefa (veja listar_tarefas) ou o título exato." };
const requirementRef = { type: "string", description: "Código do requisito, ex.: RF03." };
const day = (what: string) => ({ type: "string", description: `${what} no formato AAAA-MM-DD.` });
const clearable = (description: string) => ({ type: "string", description: `${description} Texto vazio desfaz o vínculo.` });

const TOOLS = [
  {
    name: "listar_projetos",
    title: "Listar projetos",
    description: "Lista os projetos que esta conta pode ver no FlowBot, com o id e o cargo em cada um.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "ler_projeto",
    title: "Ler projeto",
    description:
      "Contexto completo de um projeto: requisitos, funcionalidades, colunas, tarefas, sprints, componentes e o andamento já registrado. Leia antes de desenvolver.",
    inputSchema: { type: "object", properties: { projeto_id: projectId }, required: ["projeto_id"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "listar_tarefas",
    title: "Listar tarefas",
    description: "Tarefas do projeto com id, coluna, prioridade, prazo, requisito, sprint e descrição.",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        sprint: { type: "string", description: "Filtra pelo nome (ou parte do nome) da sprint." },
        coluna: { type: "string", description: "Filtra pela coluna do Kanban (ex.: Backlog)." },
        somente_abertas: { type: "boolean", description: "Só as que não estão concluídas (padrão: true)." },
      },
      required: ["projeto_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "criar_tarefa",
    title: "Criar tarefa",
    description: "Cria uma tarefa no Kanban (por padrão na primeira coluna), por exemplo um bug ou ajuste descoberto ao desenvolver.",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        titulo: { type: "string" },
        descricao: { type: "string" },
        prioridade: { type: "string", enum: ["Alta", "Média", "Baixa"] },
        requisito: { type: "string", description: "Código do requisito, ex.: RF03." },
        funcionalidade: { type: "string", description: "Nome exato da funcionalidade." },
        sprint: { type: "string", description: "Nome da sprint." },
        coluna: { type: "string", description: "Nome da coluna (padrão: a primeira)." },
        prazo: day("Prazo"),
        responsavel: { type: "string", description: "Nome do responsável principal." },
        participantes: { type: "array", items: { type: "string" }, description: "Outros participantes." },
      },
      required: ["projeto_id", "titulo"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "mover_tarefa",
    title: "Mover tarefa",
    description: "Move uma tarefa para outra coluna do Kanban (ex.: Em Progresso ao começar, Concluído ao terminar). Fica no histórico da tarefa.",
    inputSchema: {
      type: "object",
      properties: { projeto_id: projectId, tarefa: taskRef, coluna: { type: "string", description: "Nome da coluna de destino." } },
      required: ["projeto_id", "tarefa", "coluna"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "registrar_andamento",
    title: "Registrar andamento",
    description:
      "Registra o andamento do desenvolvimento na aba Desenvolvimento do projeto: o que foi feito, um problema encontrado ou uma pergunta para a equipe. As IAs do FlowBot usam esses registros para seguir o planejamento.",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        mensagem: { type: "string", description: "O que aconteceu, em português, de forma objetiva." },
        tipo: { type: "string", enum: [...DEV_NOTE_KINDS], description: "Padrão: progresso." },
        tarefa: { ...taskRef, description: "Tarefa relacionada (opcional): id ou título exato." },
        link: { type: "string", description: "Link opcional (pull request, commit, deploy)." },
      },
      required: ["projeto_id", "mensagem"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "ler_tarefa",
    title: "Ler tarefa",
    description: "Uma tarefa por inteiro: descrição completa, equipe, vínculos, histórico de colunas e o andamento registrado nela.",
    inputSchema: { type: "object", properties: { projeto_id: projectId, tarefa: taskRef }, required: ["projeto_id", "tarefa"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "atualizar_tarefa",
    title: "Atualizar tarefa",
    description: "Altera os campos de uma tarefa; só muda o que for informado. coluna move a tarefa como mover_tarefa.",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        tarefa: taskRef,
        titulo: { type: "string" },
        descricao: { type: "string", description: "Texto vazio apaga a descrição." },
        prioridade: { type: "string", enum: ["Alta", "Média", "Baixa"] },
        prazo: { type: "string", description: "Prazo no formato AAAA-MM-DD. Texto vazio remove o prazo." },
        requisito: clearable("Código do requisito, ex.: RF03."),
        funcionalidade: clearable("Nome exato da funcionalidade."),
        sprint: clearable("Nome da sprint."),
        responsavel: { type: "string", description: "Nome do responsável principal." },
        participantes: { type: "array", items: { type: "string" }, description: "Lista completa de participantes (substitui a atual)." },
        coluna: { type: "string", description: "Nome da coluna de destino (o mesmo que mover_tarefa)." },
      },
      required: ["projeto_id", "tarefa"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "excluir_tarefa",
    title: "Excluir tarefa",
    description: "Exclui de vez uma tarefa do Kanban, com o histórico dela. Não tem como desfazer: confirme com a pessoa antes.",
    inputSchema: { type: "object", properties: { projeto_id: projectId, tarefa: taskRef }, required: ["projeto_id", "tarefa"], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  {
    name: "criar_requisito",
    title: "Criar requisito",
    description: "Cria um requisito. Sem codigo, recebe o próximo livre do tipo (ex.: RF08 ou RNF05).",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        tipo: { type: "string", enum: ["Funcional", "Não Funcional"] },
        descricao: { type: "string", description: "O que o sistema deve fazer ou atender." },
        prioridade: { type: "string", enum: ["Alta", "Média", "Baixa"], description: "Padrão: Média." },
        status: { type: "string", enum: ["Em Aberto", "Validado", "Descartado"], description: "Padrão: Em Aberto." },
        nivel: { type: "string", enum: ["Sistema", "Subsistema", "Componente"] },
        codigo: { type: "string", description: "Opcional, ex.: RF08. Precisa combinar com o tipo e estar livre." },
      },
      required: ["projeto_id", "tipo", "descricao"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "atualizar_requisito",
    title: "Atualizar requisito",
    description: "Altera descrição, prioridade, status ou nível de um requisito. A versão anterior fica no histórico do requisito.",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        requisito: requirementRef,
        descricao: { type: "string" },
        prioridade: { type: "string", enum: ["Alta", "Média", "Baixa"] },
        status: { type: "string", enum: ["Em Aberto", "Validado", "Descartado"] },
        nivel: { type: "string", description: "Sistema, Subsistema ou Componente; texto vazio remove." },
      },
      required: ["projeto_id", "requisito"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "criar_funcionalidade",
    title: "Criar funcionalidade",
    description: "Cria uma funcionalidade (capacidade do produto), opcionalmente ligada a um requisito.",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        nome: { type: "string" },
        descricao: { type: "string" },
        status: { type: "string", enum: ["Planejada", "Em desenvolvimento", "Concluída"], description: "Padrão: Planejada." },
        requisito: requirementRef,
      },
      required: ["projeto_id", "nome"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "criar_sprint",
    title: "Criar sprint",
    description: "Cria uma sprint com as tarefas que a compõem (ao menos uma, como na tela). Para pôr outras tarefas depois, use atualizar_tarefa com o campo sprint.",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        nome: { type: "string" },
        objetivo: { type: "string" },
        inicio: day("Início"),
        fim: day("Fim"),
        tarefas: { type: "array", items: { type: "string" }, minItems: 1, description: "Ids ou títulos exatos das tarefas." },
      },
      required: ["projeto_id", "nome", "inicio", "fim", "tarefas"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "atualizar_sprint",
    title: "Atualizar sprint",
    description: "Altera nome, objetivo, início ou fim de uma sprint; só muda o que for informado. Tarefas entram e saem da sprint por atualizar_tarefa (campo sprint).",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        sprint: { type: "string", description: "Id ou nome da sprint." },
        nome: { type: "string" },
        objetivo: { type: "string", description: "Texto vazio apaga o objetivo." },
        inicio: day("Início"),
        fim: day("Fim"),
      },
      required: ["projeto_id", "sprint"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "criar_componente",
    title: "Criar componente",
    description: "Cadastra um componente do produto (hardware ou software pago), com quantidade e preço unitário.",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        nome: { type: "string" },
        descricao: { type: "string" },
        quantidade: { type: "integer", minimum: 1, description: "Padrão: 1." },
        preco_unitario: { type: "number", minimum: 0, description: "Em reais. Padrão: 0." },
        dominio: { type: "string", enum: ["Hardware", "Software"], description: "Padrão: Hardware." },
        requisito: requirementRef,
      },
      required: ["projeto_id", "nome"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "acionar_ia",
    title: "Acionar IA do FlowBot",
    description:
      "Consulta uma IA do FlowBot com o contexto do projeto e devolve a resposta (pode levar até um minuto). Usa a IA escolhida pela conta em Minhas IAs ou a IA gratuita do FlowBot. Alterações que ela propuser NÃO são aplicadas: vêm listadas com a ferramenta que as aplica.",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: projectId,
        instrucao: { type: "string", description: "O que pedir à IA, em português." },
        agente: {
          type: "string",
          enum: [...AI_AGENTS],
          description:
            "assistente (padrão, o projeto inteiro), gerente (prioridades e prazos), analista_sprints, analista_recursos (custos), revisor_requisitos, qualidade (testes e riscos) ou arquiteto.",
        },
      },
      required: ["projeto_id", "instrucao"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
] as const;

type ToolArgs = Record<string, unknown>;
const HANDLERS: Record<string, (user: BridgeUser, args: ToolArgs) => Promise<string>> = {
  listar_projetos: (user) => listProjects(user),
  ler_projeto: readProject,
  listar_tarefas: listProjectTasks,
  criar_tarefa: createProjectTask,
  mover_tarefa: moveProjectTask,
  registrar_andamento: recordProgress,
  ler_tarefa: readProjectTask,
  atualizar_tarefa: updateProjectTask,
  excluir_tarefa: deleteProjectTask,
  criar_requisito: createProjectRequirement,
  atualizar_requisito: updateProjectRequirement,
  criar_funcionalidade: createProjectFeature,
  criar_sprint: createProjectSprint,
  atualizar_sprint: updateProjectSprint,
  criar_componente: createProjectComponent,
  acionar_ia: askProjectAi,
};

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(message: RpcRequest, user: BridgeUser): Promise<object | null> {
  // Notificação (sem id): não tem resposta.
  const isNotification = message.id === undefined;
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return isNotification ? null : rpcError(message.id, -32600, "Pedido JSON-RPC inválido");
  }
  if (isNotification) return null;

  switch (message.method) {
    case "initialize": {
      const asked = message.params?.protocolVersion;
      const protocolVersion = typeof asked === "string" && SUPPORTED_VERSIONS.includes(asked) ? asked : LATEST_VERSION;
      return rpcResult(message.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "flowbot", title: "FlowBot", version: "1.0.0" },
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(message.id, {});
    case "tools/list":
      return rpcResult(message.id, { tools: TOOLS });
    case "tools/call": {
      const name = message.params?.name;
      const handler = typeof name === "string" ? HANDLERS[name] : undefined;
      if (!handler) return rpcError(message.id, -32602, `Ferramenta desconhecida: ${String(name)}`);
      const args = (message.params?.arguments ?? {}) as ToolArgs;
      try {
        const text = await handler(user, typeof args === "object" && args !== null ? args : {});
        return rpcResult(message.id, { content: [{ type: "text", text }] });
      } catch (error) {
        if (error instanceof BridgeError) {
          return rpcResult(message.id, { content: [{ type: "text", text: error.message }], isError: true });
        }
        console.error(`[MCP] Erro em ${name}:`, error);
        return rpcResult(message.id, {
          content: [{ type: "text", text: "Erro interno do FlowBot ao executar a ferramenta. Tente de novo." }],
          isError: true,
        });
      }
    }
    default:
      return rpcError(message.id, -32601, `Método não suportado: ${message.method}`);
  }
}

function unauthorized() {
  return Response.json(
    rpcError(null, -32001, "Token do FlowBot ausente ou inválido. Gere um token em Minhas IAs e envie no cabeçalho Authorization: Bearer."),
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="FlowBot"' } }
  );
}

export async function POST(req: NextRequest) {
  // Navegadores mandam Origin: um site de terceiros não chama o servidor com a sessão de ninguém.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.nextUrl.host) {
    return Response.json(rpcError(null, -32000, "Origem não permitida"), { status: 403 });
  }

  const user = await userFromBearer(req.headers.get("authorization"));
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(rpcError(null, -32700, "JSON inválido"), { status: 400 });
  }

  const batch = Array.isArray(body);
  const messages = (batch ? body : [body]) as RpcRequest[];
  if (messages.length === 0 || messages.length > 20) {
    return Response.json(rpcError(null, -32600, "Pedido JSON-RPC inválido"), { status: 400 });
  }

  const responses = (await Promise.all(messages.map((m) => handle(m ?? {}, user)))).filter(
    (r): r is object => r !== null
  );
  // Só notificações: aceito, sem corpo.
  if (responses.length === 0) return new Response(null, { status: 202 });
  return Response.json(batch ? responses : responses[0]);
}

// Sem fluxo SSE do servidor nem sessões: GET e DELETE não se aplicam.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
