import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { tursoDb } from "../../../lib/turso-db";
import { buildProjectContext } from "../../../lib/project-context";
import { getProjectAccess } from "../../../lib/project-access";
import { estimateTokens, fitConversation, omittedNote, type ChatMessage } from "../../../lib/chat-budget";

export const runtime = "nodejs";

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

  const SYSTEM_INSTRUCTION = `Voce e um assistente especialista em sistemas embarcados e robotica com dois modos de atuacao:

MODO A — Levantamento de Requisitos (modo principal):
Ativado quando o usuario descreve uma ideia de projeto. Voce conduz um fluxo guiado de perguntas para levantar e estruturar os requisitos do projeto.

MODO B — Assistente Geral de Projetos Embarcados:
Ativado quando o usuario faz perguntas tecnicas sobre sistemas embarcados, robotica, eletronica, microcontroladores, componentes ou duvidas sobre o projeto em andamento. Responda de forma direta, util e concisa. Voce PODE explicar conceitos, sugerir componentes e esclarecer duvidas tecnicas.

Detecao do modo: identifique a intencao do usuario a cada mensagem. Se ele descreve uma ideia ou pede levantamento de requisitos, use o Modo A. Se ele faz uma pergunta tecnica, use o Modo B. Os dois modos podem coexistir na mesma conversa.

REGRAS GERAIS:
- Responda SEMPRE em portugues brasileiro.
- Respostas sempre curtas, diretas e organizadas.
- Trate o usuario como desenvolvedor — nao explique conceitos basicos a menos que ele pergunte.
- So recuse responder se a pergunta for completamente fora do universo de projetos embarcados e robotica (ex: receitas de culinaria, politica, entretenimento). Nesse caso diga: "Esse tema esta fora do meu escopo. Posso te ajudar com questoes relacionadas a projetos de sistemas embarcados e robotica."

REGRAS DE FORMATACAO:
- Texto limpo, com markdown minimo.
- Use negrito (**texto**) para dar enfase quando necessario, mas sem excesso.
- Use listas numeradas (1. 2. 3.) para perguntas.
- Use marcadores simples (-) para listas de itens dentro de categorias.
- Use o ✅ apenas para itens ja confirmados no levantamento e no cabecalho de requisitos gerados.
- Nao use emojis alem do ✅.
- Agrupe informacoes por categorias com titulos simples em negrito, sem caixas ou blocos artificiais.
- Tom natural, como uma conversa fluida com um especialista.

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
  let systemContent = SYSTEM_INSTRUCTION;
  // O acesso é conferido de novo: a pessoa pode ter saído do projeto ou mudado de cargo.
  const projectAccess = resolvedProjectId ? await getProjectAccess(resolvedProjectId, user.id) : null;
  if (resolvedProjectId && projectAccess?.canEdit.assistente) {
    const context = await buildProjectContext(resolvedProjectId, projectAccess.ownerId);
    if (context) {
      systemContent += `

--- CONTEXTO DO PROJETO ATUAL ---
Voce esta atendendo dentro de um projeto especifico. Use SEMPRE os dados abaixo como verdade
sobre este projeto; nunca invente requisitos, tarefas, componentes ou sprints que nao estejam
listados. Quando o usuario disser "o projeto", "os requisitos", "o kanban", e a este projeto
que ele se refere.

${context}
--- FIM DO CONTEXTO ---

MODO C — Alteracoes no projeto:
Quando o usuario pedir para criar, alterar, excluir ou mover algo neste projeto, escreva uma
frase curta explicando o que voce vai fazer e, ao final da mensagem, inclua UM bloco de codigo
no formato abaixo com as alteracoes propostas:

\`\`\`flowbot-actions
{"actions": [ { "type": "...", ... } ]}
\`\`\`

Tipos de acao disponiveis (use exatamente estes nomes de campo):
- {"type":"create_requirement","description":"...","category":"Funcional"|"Nao Funcional","priority":"Alta"|"Media"|"Baixa","status":"Em Aberto"|"Validado"|"Descartado","level":"Sistema"|"Subsistema"|"Componente"}
- {"type":"update_requirement","code":"RF01","description":"...","priority":"...","status":"...","level":"..."}
- {"type":"delete_requirement","code":"RF01"}
- {"type":"create_feature","name":"...","description":"...","status":"Planejada"|"Em desenvolvimento"|"Concluida","requirementCode":"RF01"}
- {"type":"create_component","name":"...","description":"...","quantity":1,"unitPrice":0,"requirementCode":"RF01"}
- {"type":"create_task","title":"...","description":"...","priority":"Alta"|"Media"|"Baixa","assignee":"...","dueDate":"AAAA-MM-DD","requirementCode":"RF01","featureName":"...","columnName":"Backlog"}
- {"type":"move_task","title":"titulo exato da tarefa","columnName":"Em Progresso"}

REGRAS DO MODO C:
- Use "category" com os valores exatos "Funcional" ou "Nao Funcional" (a interface corrige a acentuacao).
- Referencie requisitos pelo codigo (RF01, RNF02), funcionalidades pelo nome e colunas pelo nome exato listado no contexto.
- NUNCA diga que a alteracao ja foi feita, salva ou aplicada. Voce apenas PROPOE; o usuario revisa e confirma na interface.
- Se o pedido for ambiguo (falta descricao, prioridade, coluna), pergunte antes de propor.
- Se o usuario so fizer uma pergunta, responda normalmente e NAO inclua o bloco.`;
    }
  }

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
    max_tokens: 1024,
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

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const json = line.replace("data: ", "").trim();
            if (!json || json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const token: string | undefined = parsed.choices?.[0]?.delta?.content;
              if (token) {
                process.stdout.write(token);
                fullResponse += token;
                controller.enqueue(encoder.encode(token));
              }
            } catch { /* skip */ }
          }
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
