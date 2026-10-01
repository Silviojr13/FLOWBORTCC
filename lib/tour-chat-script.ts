/**
 * Conversa roteirizada da demonstração de criação de projeto com IA no tour guiado.
 *
 * É pré-escrita (e não gerada pelo modelo) para o tutorial ser instantâneo, sempre igual
 * e independente do limite de requisições do provedor de IA. Segue o mesmo formato do
 * Modo A do assistente, e os requisitos gerados no fim são exatamente os do projeto de
 * exemplo criado em lib/tour-seed.ts.
 *
 * Sem "use client": também é usada no servidor, para gravar a conversa no projeto.
 */

export interface DemoChatMessage {
  role: "user" | "assistant"
  content: string
}

export type DemoChatSegment = "ideia" | "respostas"

export const DEMO_CHAT: Record<DemoChatSegment, DemoChatMessage[]> = {
  ideia: [
    {
      role: "user",
      content: "Quero fazer um braço robótico que separe peças por cor em uma esteira.",
    },
    {
      role: "assistant",
      content: `Entendi! Você deseja desenvolver um **braço robótico para separação de peças por cor**.

Até o momento identifiquei:
✅ Atuação: braço robótico com garra
✅ Percepção: identificação da cor das peças

Ainda preciso entender alguns pontos:
1. Quantos eixos de movimento o braço terá e qual o tamanho da área de trabalho?
2. Existe algum requisito de segurança, como parada de emergência?
3. Há limite de tempo por peça ou de orçamento?`,
    },
  ],
  respostas: [
    {
      role: "user",
      content:
        "São 3 eixos numa área de 30 x 30 cm. Precisa de botão de emergência. Cada peça deve levar no máximo 8 segundos e o orçamento é de até R$ 600.",
    },
    {
      role: "assistant",
      content: `✅ Requisitos gerados com sucesso!

**Requisitos Funcionais**
RF01 – O braço deve posicionar a garra em qualquer ponto da área de trabalho de 30 x 30 cm.
RF02 – O sistema deve identificar a cor da peça na esteira antes de acioná-la.
RF03 – O operador deve poder parar o braço imediatamente por um botão de emergência.

**Requisitos Não Funcionais**
RNF01 – O ciclo completo de separação de uma peça deve levar no máximo 8 segundos.
RNF02 – O custo total dos componentes não deve ultrapassar R$ 600,00.

**Restrições Identificadas**
- Braço com 3 eixos de movimento

**Lacunas Identificadas:** Nenhuma`,
    },
  ],
}

/** A conversa inteira, na ordem — usada para gravar o histórico no projeto de exemplo. */
export const DEMO_CHAT_FULL: DemoChatMessage[] = [...DEMO_CHAT.ideia, ...DEMO_CHAT.respostas]
