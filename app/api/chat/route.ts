import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { tursoDb } from "../../../lib/turso-db";
import { buildProjectContext } from "../../../lib/project-context";
import { getProjectAccess } from "../../../lib/project-access";
import { estimateTokens, fitConversation, omittedNote, type ChatMessage } from "../../../lib/chat-budget";

export const runtime = "nodejs";

/** Abaixo do limite de 1000 tokens de saída por minuto do plano gratuito do Groq. */
const MAX_OUTPUT_TOKENS = Number(process.env.GROQ_MAX_OUTPUT_TOKENS) || 900;

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

  const apiKey = process.env.GROQ_API_KEY;
  // O projeto no Groq só libera um modelo por vez (ver console.groq.com) — respeita essa
  // configuração em vez de aceitar um model vindo do cliente, que falharia contra o allowlist.
  const model = process.env.GROQ_MODEL_NAME || "qwen/qwen3.8-27b";

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY não configurada no servidor." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

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
  console.log(`Modelo: ${model}`);
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
    const context = await buildProjectContext(resolvedProjectId, projectAccess.ownerId);
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
- Explique de forma didatica, curta e agrupada, ANTES do bloco: **Requisitos** (o que o sistema
  precisa atender), **Funcionalidades** (as capacidades que entregam isso), **Sprints e tarefas**
  (o trabalho em etapas), cada um com 1 ou 2 linhas dizendo o porque. Termine com uma linha
  "**Proximo passo:** ..." sugerindo o que fazer depois.
- Sua resposta tem um limite curto de tamanho. Por isso: no maximo 12 acoes por mensagem,
  JSON enxuto (sem campos vazios, descricoes de tarefa com ate 8 palavras) e explicacao de no
  maximo 6 linhas. Se o pacote for maior, entregue a primeira parte (ex.: funcionalidades e
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
    estimateTokens(systemContent)
  );
  if (conversation.omitted > 0) systemContent += omittedNote(conversation.omitted);

  const body = {
    model,
    stream: true,
    // O plano gratuito do Groq limita a SAÍDA a 1000 tokens por minuto (OTPM) e recusa o
    // pedido cujo max_tokens passe disso: as respostas ficam abaixo do limite, e pacotes
    // grandes de ações vêm em partes.
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [{ role: "system", content: systemContent }, ...conversation.messages],
  };

  console.log("[PAYLOAD]", JSON.stringify({
    model: body.model,
    messagesCount: body.messages.length,
    omitted: conversation.omitted,
    inputTokensEstimate: body.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0),
  }, null, 2));

  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 2000;
  let groqRes: Response | undefined;

  const apiUrl = "https://api.groq.com/openai/v1/chat/completions";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      groqRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      if (attempt === MAX_RETRIES) {
        return new Response(
          JSON.stringify({ error: "Não foi possível conectar à API do Groq." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      console.log(`[RETRY] Fetch falhou, tentativa ${attempt + 1}/${MAX_RETRIES}...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }

    if (groqRes.ok) break;

    const isTransient = groqRes.status === 500 || groqRes.status === 503;
    if (isTransient && attempt < MAX_RETRIES) {
      console.log(`[RETRY] HTTP ${groqRes.status}, tentativa ${attempt + 1}/${MAX_RETRIES}...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }

    // Limite por minuto: se o Groq pede para esperar poucos segundos, espera e tenta de novo.
    const retryAfter = Number(groqRes.headers.get("retry-after"));
    if (groqRes.status === 429 && attempt < MAX_RETRIES && retryAfter > 0 && retryAfter <= 12) {
      console.log(`[RETRY] Limite por minuto; aguardando ${retryAfter}s...`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    // O erro bruto do provedor (com ids internos da conta) fica só no log do servidor.
    const text = await groqRes.text();
    console.log(`[ERROR] Resposta de erro da API do Groq:`, text);

    const friendly =
      groqRes.status === 413
        ? "A conversa ficou grande demais para o limite da IA. Comece uma nova conversa ou resuma o que já foi definido."
        : groqRes.status === 429
          ? "A IA atingiu o limite de uso por minuto. Aguarde cerca de um minuto e envie de novo."
          : "A IA não conseguiu responder agora. Tente de novo em instantes.";
    // Quanto esperar: o cabeçalho retry-after ou o "try again in 23.5s" da mensagem do Groq.
    const waitSeconds =
      groqRes.status === 429 ? Math.ceil(retryAfter > 0 ? retryAfter : parseRetrySeconds(text) ?? 30) : null;
    // O chatId vai junto: a interface reenvia na mesma conversa, sem criar outra.
    return new Response(JSON.stringify({ error: friendly, retryAfter: waitSeconds, chatId }), {
      status: groqRes.status,
      headers: { "Content-Type": "application/json", "X-Chat-Id": chatId },
    });
  }

  if (!groqRes) {
    return new Response(
      JSON.stringify({ error: "Erro desconhecido ao conectar à API." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = groqRes.body!.getReader();
      const decoder = new TextDecoder();
      process.stdout.write("[GROQ] ");
      let fullResponse = "";
      let cutByLength = false;

      // Uma linha do SSE pode chegar partida em dois pedaços da rede: o pedaço incompleto
      // fica guardado até o próximo. (Antes ele era descartado, e a resposta perdia trechos.)
      let pending = "";
      const handleLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const json = line.slice("data: ".length).trim();
        if (!json || json === "[DONE]") return;
        try {
          const parsed = JSON.parse(json);
          if (parsed.choices?.[0]?.finish_reason === "length") cutByLength = true;
          const token: string | undefined = parsed.choices?.[0]?.delta?.content;
          if (token) {
            process.stdout.write(token);
            fullResponse += token;
            controller.enqueue(encoder.encode(token));
          }
        } catch { /* linha que não é JSON (comentário do SSE) */ }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          for (const line of lines) handleLine(line);
        }
        pending += decoder.decode();
        if (pending) handleLine(pending);

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

        console.log("\n[GROQ] ✓ Resposta completa");
        console.log("─────────────────────────────────────\n");
        controller.close();
      } catch (err) {
        console.error("\n[ERRO] Stream interrompido:", err);
        controller.error(err);
      } finally {
        reader.releaseLock();
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
    },
  });
}

/** "Please try again in 23.45s" ou "in 1m2.5s" -> segundos. */
function parseRetrySeconds(message: string): number | null {
  const match = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(message);
  if (!match) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2]);
}
