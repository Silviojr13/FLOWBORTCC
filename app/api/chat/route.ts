import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { tursoDb } from "../../../lib/turso-db";
import { buildProjectContext } from "../../../lib/project-context";
import { getProjectAccess } from "../../../lib/project-access";
import { estimateTokens, fitConversation, omittedNote, INPUT_TOKEN_BUDGET, type ChatMessage } from "../../../lib/chat-budget";
import {
  AiProviderError,
  friendlyAiError,
  openChatStream,
  readChatStream,
  type AiTarget,
} from "../../../lib/ai-client";
import { AI_PROVIDER_INFO } from "../../../lib/ai-providers";
import { assistantAiKey } from "../../../lib/user-ai-keys";

export const runtime = "nodejs";

/**
 * Limites de cada resposta. A IA gratuita do FlowBot (Groq) aceita pouco por minuto: no
 * máximo 1000 tokens de saída (OTPM) e 7000 de entrada. Com a chave da própria pessoa
 * ("Minhas IAs"), cabem respostas, conversas e contexto do projeto bem maiores.
 */
const FREE_LIMITS = {
  maxOutputTokens: Number(process.env.GROQ_MAX_OUTPUT_TOKENS) || 900,
  inputBudget: INPUT_TOKEN_BUDGET,
  contextChars: 4500,
  devNotes: 3,
  maxActions: 12,
  explanationLines: 6,
};
const OWN_KEY_LIMITS = {
  maxOutputTokens: 4000,
  inputBudget: 24000,
  contextChars: 16000,
  devNotes: 8,
  maxActions: 30,
  explanationLines: 10,
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  // Verificar se o usuário está autenticado
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, chatId: providedChatId, projectId } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "Nenhuma mensagem enviada" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Quem responde: a IA que a pessoa escolheu em "Minhas IAs" ou a IA gratuita do FlowBot.
  const ownKey = await assistantAiKey(user.id);
  if (ownKey && !ownKey.target) {
    return new Response(
      JSON.stringify({ error: "Não foi possível abrir a chave da IA escolhida. Conecte-a de novo em Minhas IAs ou volte para a IA gratuita do FlowBot." }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  let target: AiTarget;
  if (ownKey?.target) {
    target = ownKey.target;
  } else {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY não configurada no servidor." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    // O projeto no Groq só libera um modelo por vez (ver console.groq.com) — respeita essa
    // configuração em vez de aceitar um model vindo do cliente, que falharia contra o allowlist.
    target = { provider: "groq", apiKey, model: process.env.GROQ_MODEL_NAME || "qwen/qwen3.8-27b" };
  }
  const usingOwnKey = Boolean(ownKey?.target);
  // Uma chave própria do Groq pode estar no plano gratuito, com os mesmos limites por minuto:
  // fica no tamanho compacto (o ganho é uma cota só da pessoa, sem dividir com o FlowBot).
  const limits = usingOwnKey && target.provider !== "groq" ? OWN_KEY_LIMITS : FREE_LIMITS;
  const providerLabel = usingOwnKey ? `${AI_PROVIDER_INFO[target.provider].label} (chave própria)` : "FlowBot (Groq)";

  const lastUserMsg: Message = messages[messages.length - 1];

  // Persistência da conversa: cria o chat na primeira mensagem e guarda a fala do usuário
  // antes de chamar o provedor de IA, para nada se perder se o streaming falhar.
  let chatId: string;
  let resolvedProjectId: string | null =
    typeof projectId === "string" && projectId ? projectId : null;
  try {
    const existing = providedChatId
      ? await tursoDb.chat.findUnique({
          where: { id: providedChatId as string, userId: user.id },
          select: { id: true, projectId: true },
        })
      : null;

    if (existing) {
      chatId = existing.id;
      resolvedProjectId = existing.projectId ?? resolvedProjectId;
    } else {
      const title = lastUserMsg.content.slice(0, 60).trim() || "Nova conversa";
      // Vincula a conversa ao projeto quando ela é aberta de dentro dele (assistente flutuante).
      // Só para quem pode usar o assistente no projeto (dono e cargos que editam).
      const access = typeof projectId === "string" && projectId ? await getProjectAccess(projectId, user.id) : null;
      const linkedProject = access?.canEdit.assistente ? { id: access.projectId } : null;

      const chat = await tursoDb.chat.create({
        data: { title, userId: user.id, projectId: linkedProject?.id ?? null },
      });
      chatId = chat.id;
      resolvedProjectId = linkedProject?.id ?? null;
    }

    // Reenvio automático (depois de esperar o limite por minuto) ou clique repetido: a mesma
    // fala não é gravada duas vezes seguidas.
    const previous = await tursoDb.message.findFirst({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      select: { role: true, content: true },
    });
    if (!(previous?.role === "user" && previous.content === lastUserMsg.content)) {
      await tursoDb.message.create({
        data: { chatId, role: "user", content: lastUserMsg.content },
      });
    }
  } catch (error) {
    console.error("Erro ao registrar a conversa:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao registrar a conversa" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log("\n─────────────────────────────────────");
  console.log(`[${new Date().toLocaleTimeString("pt-BR")}] USUÁRIO → ${lastUserMsg.content}`);
  console.log(`Modelo: ${target.model} · ${providerLabel}`);
  console.log("─────────────────────────────────────");

  const BASE_INSTRUCTION = `Voce e o FlowBot, assistente de projetos de robotica, sistemas embarcados, IoT e software
(inclusive jogos e aplicativos). Seu papel e ajudar a pessoa a tirar o projeto do papel e,
no caminho, aprender como um projeto e estruturado.

REGRAS GERAIS:
- Responda SEMPRE em portugues brasileiro.
- Seja direto e organizado, mas didatico: quando sugerir algo, diga em poucas palavras o porque.
- Ajuste o nivel a pessoa: se ela parecer iniciante, explique termos (requisito, funcionalidade, tarefa, sprint) numa frase simples.
- So recuse se o pedido nao tiver nenhuma relacao com projetos (ex.: receitas, politica). Nesse caso diga: "Esse tema esta fora do meu escopo. Posso te ajudar com o seu projeto."
- Nunca diga que o sistema esta instavel, sem conexao ou que voce "nao pode" criar coisas: se algo der errado, a interface avisa a pessoa.

REGRAS DE FORMATACAO:
- Texto limpo, com markdown minimo.
- Use negrito (**texto**) para dar enfase quando necessario, mas sem excesso.
- Use listas numeradas (1. 2. 3.) para perguntas e marcadores (-) para itens.
- Use o ✅ apenas para itens ja confirmados no levantamento e no cabecalho de requisitos gerados.
- Nao use emojis alem do ✅.
- Agrupe informacoes por categorias com titulos simples em negrito.

MODO B — Duvidas tecnicas:
Quando a pessoa fizer uma pergunta tecnica (eletronica, microcontroladores, componentes, software, engines, arquitetura), responda de forma direta e util.
`;

  const MODE_A_INSTRUCTION = `
MODO A — Levantamento de Requisitos (modo principal fora de um projeto):
Ativado quando a pessoa descreve uma ideia de projeto. Voce conduz um fluxo guiado de perguntas para levantar e estruturar os requisitos.
Identifique a intencao a cada mensagem: ideia ou pedido de requisitos -> Modo A; pergunta tecnica -> Modo B.

--- FLUXO DO MODO A (Levantamento de Requisitos) ---

ETAPA 1 — Entendimento inicial:
Analise a ideia do usuario e responda neste estilo:

"Entendi! Voce deseja desenvolver [resumo do projeto].

Ate o momento identifiquei:
✅ [item identificado 1]
✅ [item identificado 2]

Ainda preciso entender alguns pontos:
1. [pergunta sobre lacuna 1]
2. [pergunta sobre lacuna 2]
3. [pergunta sobre lacuna 3]"

Facil no maximo 3 perguntas por vez. Categorize internamente as informacoes em: Sensores, Atuadores, Comunicacao, Processamento, Alimentacao, Interface, Armazenamento e Restricoes.

ETAPA 2 — Refinamento:
A cada resposta do usuario, atualize o resumo do que foi identificado e continue perguntando sobre as categorias que ainda tem lacunas. Mantenha o mesmo estilo de formatacao.

ETAPA 3 — Validacao parcial:
Quando tiver informacoes suficientes, apresente um resumo organizado e pergunte se esta correto:

"Perfeito! Antes de continuar, gostaria de confirmar o que entendi:

**Monitoramento**
- item 1
- item 2

**Automacao**
- item 1

**Acesso**
- item 1

Esta correto? [Confirmar] [Editar]"

ETAPA 4 — Geracao dos requisitos (SOMENTE quando o usuario solicitar explicitamente):

"✅ Requisitos gerados com sucesso!

**Requisitos Funcionais**
RF01 – ...
RF02 – ...

**Requisitos Nao Funcionais**
RNF01 – ...

**Restricoes Identificadas**
- ...

**Lacunas Identificadas:** [listar se houver, ou escrever 'Nenhuma']"

--- FIM DAS INSTRUCOES ---`;

  // MODO C: dentro de um projeto, o assistente recebe o estado atual e pode propor
  // alterações. Quem executa é a interface, e só depois da confirmação do usuário.
  let systemContent = BASE_INSTRUCTION;
  let inProject = false;
  // O acesso é conferido de novo: a pessoa pode ter saído do projeto ou mudado de cargo.
  const projectAccess = resolvedProjectId ? await getProjectAccess(resolvedProjectId, user.id) : null;
  if (resolvedProjectId && projectAccess?.canEdit.assistente) {
    const context = await buildProjectContext(resolvedProjectId, projectAccess.ownerId, limits.contextChars, {
      hideCosts: !projectAccess.canSeeCosts,
      devNotes: limits.devNotes,
    });
    if (context) {
      inProject = true;
      const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      systemContent += `

--- CONTEXTO DO PROJETO ATUAL ---
Voce esta dentro de um projeto especifico. Use os dados abaixo como verdade sobre ele; nunca
invente requisitos, tarefas ou sprints que nao estejam listados. Hoje e ${today}: datas
novas comecam a partir de hoje, no ano de ${today.slice(-4)} ou depois.

${context}
--- FIM DO CONTEXTO ---

MODO C — Montar e alterar o projeto:
Voce pode criar e alterar requisitos, funcionalidades, sprints, tarefas e componentes. Voce
PROPOE; a pessoa revisa num card e confirma com um clique. Seja proativo e entregue pronto:

- Quando a pessoa pedir para estruturar, planejar, organizar, quebrar em tarefas ou "montar" o
  projeto (ou uma parte dele), NAO faca perguntas antes: proponha um pacote completo com
  suposicoes razoaveis (requisitos que faltam, funcionalidades, sprints com datas, tarefas de
  cada funcionalidade com prioridade, prazo e coluna, e componentes quando fizer sentido).
  Liste as suposicoes numa linha; a pessoa ajusta depois.
- So pergunte antes quando faltar algo impossivel de supor (ex.: o objetivo do projeto).
- O ANDAMENTO DO DESENVOLVIMENTO (quando houver) vem do Claude Code, que desenvolve o software:
  use-o para acompanhar o projeto e sugerir a continuidade (ex.: tarefas para os problemas
  relatados, respostas as perguntas, proximas tarefas da sprint).
- Explique de forma didatica, curta e agrupada, ANTES do bloco: **Requisitos** (o que o sistema
  precisa atender), **Funcionalidades** (as capacidades que entregam isso), **Sprints e tarefas**
  (o trabalho em etapas), cada um com 1 ou 2 linhas dizendo o porque. Termine com uma linha
  "**Proximo passo:** ..." sugerindo o que fazer depois.
- Sua resposta tem um limite de tamanho. Por isso: no maximo ${limits.maxActions} acoes por mensagem,
  JSON enxuto (sem campos vazios, descricoes de tarefa com ate 8 palavras) e explicacao de no
  maximo ${limits.explanationLines} linhas. Se o pacote for maior, entregue a primeira parte (ex.: funcionalidades e
  as tarefas da primeira sprint) e diga que, depois de confirmar, voce monta o resto.
- Itens criados no mesmo bloco podem ser referenciados pelos seguintes: use o codigo que o
  requisito novo vai receber (o proximo numero livre: se existem RF01 a RF03, o novo e RF04) e
  o nome exato da funcionalidade ou sprint nova.
- Toda sprint nova precisa de ao menos uma tarefa apontando para ela (sprintName na tarefa
  criada ou alterada); use o nome exato da sprint.
- NUNCA diga que a alteracao ja foi feita ou salva: a pessoa ainda vai confirmar.
- Se a pessoa so fizer uma pergunta, responda normalmente e NAO inclua o bloco.

Formato: ao final da mensagem, UM bloco de codigo assim:

\`\`\`flowbot-actions
{"actions": [ { "type": "...", ... } ]}
\`\`\`

Tipos de acao (use exatamente estes nomes de campo; datas no formato AAAA-MM-DD):
- {"type":"create_requirement","description":"...","category":"Funcional"|"Nao Funcional","priority":"Alta"|"Media"|"Baixa","level":"Sistema"|"Subsistema"|"Componente"}
- {"type":"update_requirement","code":"RF01","description":"...","priority":"...","status":"Em Aberto"|"Validado"|"Descartado"}
- {"type":"delete_requirement","code":"RF01"}
- {"type":"create_feature","name":"...","description":"...","status":"Planejada"|"Em desenvolvimento"|"Concluida","requirementCode":"RF01"}
- {"type":"update_feature","name":"nome exato","status":"...","description":"..."}
- {"type":"create_sprint","name":"Sprint 1 — ...","goal":"...","startDate":"AAAA-MM-DD","endDate":"AAAA-MM-DD"}
- {"type":"create_task","title":"...","description":"...","priority":"Alta"|"Media"|"Baixa","assignee":"...","participants":["..."],"dueDate":"AAAA-MM-DD","requirementCode":"RF01","featureName":"...","sprintName":"...","columnName":"Backlog"}
- {"type":"update_task","title":"titulo exato","priority":"...","assignee":"...","dueDate":"...","sprintName":"...","columnName":"..."}
- {"type":"move_task","title":"titulo exato","columnName":"Em Progresso"}
- {"type":"create_component","name":"...","description":"...","quantity":1,"unitPrice":0,"domain":"Hardware"|"Software","requirementCode":"RF01"}

Regras do bloco: categoria "Funcional" ou "Nao Funcional" (a interface corrige acentos);
referencie requisitos pelo codigo, funcionalidades e sprints pelo nome e colunas pelo nome
exato do contexto; so use responsavel (assignee) com nomes que aparecem no projeto.`;
    }
  }

  if (!inProject) systemContent += MODE_A_INSTRUCTION;

  // A conversa inteira não cabe no limite de tokens por minuto do plano gratuito: vão a
  // primeira mensagem e as mais recentes, e a IA é avisada do que ficou de fora.
  const conversation = fitConversation(
    messages.map((m: Message) => ({ role: m.role, content: String(m.content ?? "") }) as ChatMessage),
    estimateTokens(systemContent),
    limits.inputBudget
  );
  if (conversation.omitted > 0) systemContent += omittedNote(conversation.omitted);

  console.log("[PAYLOAD]", JSON.stringify({
    model: target.model,
    provider: target.provider,
    ownKey: usingOwnKey,
    messagesCount: conversation.messages.length + 1,
    omitted: conversation.omitted,
    inputTokensEstimate:
      estimateTokens(systemContent) + conversation.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0),
  }, null, 2));

  const logTag = usingOwnKey ? target.provider.toUpperCase() : "GROQ";
  let providerRes: Response;
  try {
    // Na IA gratuita, o limite de saída fica abaixo do OTPM do Groq, que recusa pedidos com
    // max_tokens acima dele: pacotes grandes de ações vêm em partes.
    providerRes = await openChatStream(
      target,
      { system: systemContent, messages: conversation.messages, maxTokens: limits.maxOutputTokens },
      { logLabel: logTag }
    );
  } catch (error) {
    if (!(error instanceof AiProviderError)) {
      console.error("[ERRO] Falha ao chamar a IA:", error);
      return new Response(
        JSON.stringify({ error: "Erro desconhecido ao conectar à IA.", chatId }),
        { status: 500, headers: { "Content-Type": "application/json", "X-Chat-Id": chatId } }
      );
    }
    const friendly = friendlyAiError(error, { providerOf: AI_PROVIDER_INFO[target.provider].of, ownKey: usingOwnKey });
    // 429 com retryAfter faz a interface esperar e reenviar sozinha; sem crédito não adianta.
    const status = error.kind === "rate" ? 429 : error.kind === "quota" ? 402 : error.status >= 400 ? error.status : 502;
    // O chatId vai junto: a interface reenvia na mesma conversa, sem criar outra.
    return new Response(
      JSON.stringify({ error: friendly, retryAfter: error.kind === "rate" ? error.retryAfter : null, chatId }),
      { status, headers: { "Content-Type": "application/json", "X-Chat-Id": chatId } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      process.stdout.write(`[${logTag}] `);
      let fullResponse = "";
      let cutByLength = false;

      try {
        for await (const piece of readChatStream(target.provider, providerRes)) {
          if (piece.cutByLength) cutByLength = true;
          if (piece.text) {
            process.stdout.write(piece.text);
            fullResponse += piece.text;
            controller.enqueue(encoder.encode(piece.text));
          }
        }

        // Resposta cortada pelo limite de tamanho: avisa como continuar (a interface aproveita
        // as ações que chegaram inteiras).
        if (cutByLength) {
          const note = "\n\n_(A resposta chegou ao limite de tamanho da IA. Escreva \"continue\" para eu seguir de onde parei.)_";
          fullResponse += note;
          controller.enqueue(encoder.encode(note));
        }

        // Salvar a resposta da IA no banco de dados após completar a resposta
        if (fullResponse.trim()) {
          await tursoDb.message.create({
            data: {
              chatId: chatId,
              role: "assistant",
              content: fullResponse,
            },
          });
          // Toca o chat para que a lista de conversas venha ordenada pela atividade.
          await tursoDb.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
          });
        }

        console.log(`\n[${logTag}] ✓ Resposta completa`);
        console.log("─────────────────────────────────────\n");
        controller.close();
      } catch (err) {
        console.error("\n[ERRO] Stream interrompido:", err);
        controller.error(err);
      }
    },
  });

  // Retornar o chatId no header para o frontend
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "X-Chat-Id": chatId,
      // Quantas mensagens antigas não foram enviadas à IA (a interface pode avisar).
      "X-Chat-Omitted": String(conversation.omitted),
      // Quem respondeu: a IA gratuita do FlowBot ou a chave da própria pessoa.
      "X-Chat-Provider": encodeURIComponent(`${providerLabel} · ${target.model}`),
    },
  });
}
