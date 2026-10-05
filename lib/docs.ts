/**
 * Documentação de engenharia do projeto: o catálogo de documentos, cada um seguindo a sua
 * norma internacional (ISO/IEC/IEEE), adotadas no Brasil pela ABNT com o mesmo conteúdo.
 *
 * Cada seção é de um de três tipos:
 * - "ia": texto escrito pela IA a partir dos dados do projeto (e editável);
 * - "dados": tabela montada direto do banco, sempre igual ao estado atual do projeto;
 * - "diagrama": o diagrama salvo na aba Diagramas.
 */

export type DocSectionKind = "ia" | "dados" | "diagrama"

/** Tabelas montadas a partir do banco (lib/docs-server.ts). */
export type DocDataSource =
  | "funcionalidades"
  | "requisitos-funcionais"
  | "requisitos-nao-funcionais"
  | "rastreabilidade"
  | "cobertura"
  | "componentes"
  | "sprints"
  | "equipe"
  | "recursos"
  | "escopo"

export interface DocSectionDef {
  key: string
  title: string
  kind: DocSectionKind
  /** O que a seção deve conter (orienta a IA e quem edita). */
  guide: string
  data?: DocDataSource
  /** Tipo do diagrama em lib/diagrams.ts. */
  diagram?: string
}

export interface DocTypeDef {
  key: string
  title: string
  /** Norma ou referência que a estrutura segue. */
  standard: string
  purpose: string
  sections: DocSectionDef[]
}

export const DOC_TYPES: DocTypeDef[] = [
  {
    key: "visao",
    title: "Documento de Visão",
    standard: "ISO/IEC/IEEE 29148:2018 (especificação de necessidades das partes interessadas)",
    purpose: "Define o problema, quem é afetado, o produto proposto e os seus limites.",
    sections: [
      { key: "introducao", title: "Introdução", kind: "ia", guide: "Propósito do documento, escopo do produto, público-alvo do documento e visão geral das seções." },
      { key: "problema", title: "Declaração do problema", kind: "ia", guide: "O problema, quem ele afeta, o impacto e como seria uma solução bem-sucedida. Use a forma: O problema de / afeta / cujo impacto é / uma solução de sucesso." },
      { key: "partes", title: "Partes interessadas e usuários", kind: "ia", guide: "Tabela com parte interessada, descrição, responsabilidades e interesse no produto; depois o perfil dos usuários." },
      { key: "produto", title: "Visão geral do produto", kind: "ia", guide: "Posicionamento (para / que / o produto é / diferente de), perspectiva do produto e principais benefícios." },
      { key: "funcionalidades", title: "Funcionalidades do produto", kind: "dados", data: "funcionalidades", guide: "Capacidades do produto e o requisito que cada uma atende." },
      { key: "restricoes", title: "Restrições, premissas e dependências", kind: "ia", guide: "Restrições técnicas, de prazo e de custo, premissas assumidas e dependências externas." },
      { key: "qualidade", title: "Atributos de qualidade", kind: "dados", data: "requisitos-nao-funcionais", guide: "Requisitos não funcionais do produto." },
    ],
  },
  {
    key: "srs",
    title: "Especificação de Requisitos (SRS)",
    standard: "ISO/IEC/IEEE 29148:2018 (especificação de requisitos de software)",
    purpose: "Especifica de forma verificável o que o sistema deve fazer e com qual qualidade.",
    sections: [
      { key: "introducao", title: "1. Introdução", kind: "ia", guide: "1.1 Propósito, 1.2 Escopo, 1.3 Definições, acrônimos e abreviações (tabela), 1.4 Referências, 1.5 Visão geral do documento." },
      { key: "descricao", title: "2. Descrição geral", kind: "ia", guide: "2.1 Perspectiva do produto, 2.2 Funções do produto (resumo), 2.3 Características dos usuários, 2.4 Restrições, 2.5 Premissas e dependências." },
      { key: "rf", title: "3.1 Requisitos funcionais", kind: "dados", data: "requisitos-funcionais", guide: "Requisitos funcionais com código, prioridade, situação e nível." },
      { key: "rnf", title: "3.2 Requisitos não funcionais", kind: "dados", data: "requisitos-nao-funcionais", guide: "Requisitos de qualidade, desempenho, segurança e restrições." },
      { key: "interfaces", title: "3.3 Interfaces externas", kind: "ia", guide: "Interfaces com o usuário, de hardware, de software e de comunicação." },
      { key: "verificacao", title: "4. Verificação", kind: "ia", guide: "Tabela: requisito, método de verificação (inspeção, análise, demonstração ou teste) e critério de aceite." },
      { key: "rastreabilidade", title: "5. Rastreabilidade", kind: "dados", data: "rastreabilidade", guide: "Requisito, funcionalidades, tarefas e componentes ligados." },
    ],
  },
  {
    key: "casos-uso",
    title: "Especificação de Casos de Uso",
    standard: "UML 2.5.1 (OMG) e o modelo de casos de uso de Cockburn",
    purpose: "Descreve como cada ator interage com o sistema para alcançar um objetivo.",
    sections: [
      { key: "atores", title: "Atores", kind: "ia", guide: "Tabela de atores (humanos e sistemas externos) com descrição e objetivos, incluindo os casos com mais de um ator." },
      { key: "diagrama", title: "Diagrama de casos de uso", kind: "diagrama", diagram: "use-case", guide: "Diagrama de casos de uso da aba Diagramas." },
      { key: "casos", title: "Casos de uso detalhados", kind: "ia", guide: "Para cada caso de uso principal: identificador (UC01...), nome, atores, requisitos relacionados, pré-condições, fluxo principal numerado, fluxos alternativos e de exceção, pós-condições." },
    ],
  },
  {
    key: "arquitetura",
    title: "Documento de Arquitetura",
    standard: "ISO/IEC/IEEE 42010:2022, modelo C4 e estrutura arc42",
    purpose: "Registra as visões, decisões e restrições da arquitetura e o que elas atendem.",
    sections: [
      { key: "objetivos", title: "Objetivos e partes interessadas", kind: "ia", guide: "Objetivos de arquitetura, partes interessadas e as preocupações (concerns) de cada uma." },
      { key: "decisoes", title: "Restrições e decisões de arquitetura", kind: "ia", guide: "Restrições técnicas e organizacionais e tabela de decisões (contexto, decisão, alternativas, consequências)." },
      { key: "contexto", title: "Visão de contexto (C4 nível 1)", kind: "diagrama", diagram: "c4-context", guide: "Sistema, pessoas e sistemas externos." },
      { key: "containers", title: "Visão de containers (C4 nível 2)", kind: "diagrama", diagram: "c4-container", guide: "Aplicações, serviços e armazenamentos." },
      { key: "componentes-c4", title: "Visão de componentes (C4 nível 3)", kind: "diagrama", diagram: "c4-component", guide: "Componentes internos do container principal." },
      { key: "dados", title: "Visão de dados", kind: "diagrama", diagram: "er", guide: "Modelo relacional." },
      { key: "comportamento", title: "Visão de comportamento", kind: "diagrama", diagram: "sequence", guide: "Sequência de um fluxo principal." },
      { key: "fisica", title: "Visão física: componentes e hardware", kind: "dados", data: "componentes", guide: "Componentes de hardware e software do produto." },
      { key: "qualidade", title: "Qualidade e riscos técnicos", kind: "ia", guide: "Cenários de qualidade (atributo, estímulo, resposta esperada) e riscos técnicos com mitigação." },
    ],
  },
  {
    key: "plano-projeto",
    title: "Plano de Projeto",
    standard: "ISO/IEC/IEEE 16326:2019 (gestão de projetos) e PMBOK",
    purpose: "Planeja escopo, cronograma, equipe, recursos, riscos e acompanhamento.",
    sections: [
      { key: "visao", title: "Visão geral do projeto", kind: "ia", guide: "Objetivos, entregáveis, critérios de sucesso e ciclo de vida adotado (por exemplo, iterativo com sprints)." },
      { key: "escopo", title: "Escopo", kind: "dados", data: "escopo", guide: "Funcionalidades e o trabalho de cada uma." },
      { key: "cronograma", title: "Cronograma", kind: "dados", data: "sprints", guide: "Sprints, períodos, objetivos e andamento." },
      { key: "gantt", title: "Cronograma (Gantt)", kind: "diagrama", diagram: "gantt", guide: "Gráfico de Gantt das sprints e tarefas, da aba Diagramas." },
      { key: "equipe", title: "Organização e papéis", kind: "dados", data: "equipe", guide: "Pessoas do projeto e o cargo de cada uma." },
      { key: "recursos", title: "Recursos e custos", kind: "dados", data: "recursos", guide: "Recursos, custos e orçamento." },
      { key: "riscos", title: "Gestão de riscos", kind: "ia", guide: "Tabela de riscos: identificador, descrição, probabilidade, impacto, resposta e responsável." },
      { key: "comunicacao", title: "Comunicação e acompanhamento", kind: "ia", guide: "Ritos (reuniões, revisões de sprint), canais, indicadores acompanhados e relatórios." },
      { key: "qualidade", title: "Garantia da qualidade", kind: "ia", guide: "Padrões seguidos, revisões, critérios de pronto e de aceite." },
    ],
  },
  {
    key: "plano-testes",
    title: "Plano de Testes",
    standard: "ISO/IEC/IEEE 29119-3:2021 (documentação de testes)",
    purpose: "Define o que será testado, como, com quais critérios e a cobertura dos requisitos.",
    sections: [
      { key: "escopo", title: "Escopo e itens de teste", kind: "ia", guide: "Itens que serão e que não serão testados, e por quê." },
      { key: "estrategia", title: "Estratégia de teste", kind: "ia", guide: "Níveis (unidade, integração, sistema, aceitação), tipos (funcional, usabilidade, desempenho, segurança), técnicas, ferramentas e ambiente." },
      { key: "casos", title: "Casos de teste", kind: "ia", guide: "Tabela: identificador (CT01...), requisito, pré-condição, passos, dados de entrada e resultado esperado. Cubra os requisitos principais." },
      { key: "criterios", title: "Critérios de entrada, saída e suspensão", kind: "ia", guide: "Quando os testes começam, terminam e são suspensos; como os defeitos são registrados." },
      { key: "cobertura", title: "Cobertura dos requisitos", kind: "dados", data: "cobertura", guide: "Situação de cada requisito pelas tarefas ligadas." },
    ],
  },
  {
    key: "rastreabilidade",
    title: "Matriz de Rastreabilidade",
    standard: "ISO/IEC/IEEE 29148:2018 (rastreabilidade de requisitos)",
    purpose: "Liga cada requisito às funcionalidades, tarefas e componentes que o implementam.",
    sections: [
      { key: "matriz", title: "Matriz requisito × implementação", kind: "dados", data: "rastreabilidade", guide: "Requisito, funcionalidades, tarefas e componentes." },
      { key: "diagrama", title: "Diagrama de rastreabilidade", kind: "diagrama", diagram: "traceability", guide: "Requisitos ligados às funcionalidades e componentes, da aba Diagramas." },
      { key: "cobertura", title: "Cobertura", kind: "dados", data: "cobertura", guide: "Situação de cada requisito." },
      { key: "analise", title: "Análise de lacunas", kind: "ia", guide: "Requisitos sem implementação, funcionalidades sem requisito, riscos de cobertura e recomendações." },
    ],
  },
  {
    key: "manual",
    title: "Manual do Usuário",
    standard: "ISO/IEC/IEEE 26514:2022 (documentação para o usuário)",
    purpose: "Ensina o usuário a realizar as tarefas com o produto.",
    sections: [
      { key: "introducao", title: "Introdução", kind: "ia", guide: "Para quem é o manual, o que o produto faz e as convenções usadas." },
      { key: "inicio", title: "Primeiros passos", kind: "ia", guide: "Requisitos para usar, acesso, instalação ou montagem e primeira configuração." },
      { key: "tarefas", title: "Como realizar as tarefas", kind: "ia", guide: "Um procedimento numerado para cada tarefa principal do usuário, baseado nas funcionalidades." },
      { key: "problemas", title: "Solução de problemas", kind: "ia", guide: "Tabela de sintoma, causa provável e solução; perguntas frequentes." },
      { key: "glossario", title: "Glossário", kind: "ia", guide: "Termos técnicos usados no manual e o significado de cada um." },
    ],
  },
]

/** Aviso no fim de uma seção que parou no limite de tamanho da IA (dá para continuar). */
export const DOC_CUT_NOTE = "_(A seção parou no limite de tamanho da IA. Use Continuar para a IA seguir de onde parou.)_"

/** O aviso de corte, inclusive o da primeira versão do texto. */
const CUT_NOTE_PATTERN = /\n*_\(A seção (?:parou|chegou) [^\n]*limite de tamanho da IA[^\n]*\)_\s*/g

export function isCutSection(content: string): boolean {
  return /_\(A seção (?:parou|chegou) [^\n]*limite de tamanho da IA[^\n]*\)_\s*$/.test(content)
}

/** O texto da seção sem o aviso de corte. */
export function stripCutNote(content: string): string {
  return content.replace(CUT_NOTE_PATTERN, "\n").trimEnd()
}

export function getDocType(key: string): DocTypeDef | undefined {
  return DOC_TYPES.find((d) => d.key === key)
}

/** Seção como a tela recebe: o conteúdo atual e de onde ele veio. */
export interface DocSectionView {
  key: string
  title: string
  kind: DocSectionKind
  guide: string
  /** Markdown; vazio quando a seção de IA ainda não foi escrita. */
  content: string
  source: "ia" | "manual" | "dados" | "diagrama" | null
  updatedAt: string | null
}

export interface DocRevision {
  version: string
  date: string
  author: string | null
  note: string
}

export interface DocView {
  type: string
  title: string
  standard: string
  purpose: string
  version: string
  revisions: DocRevision[]
  sections: DocSectionView[]
  updatedAt: string | null
}

/** Diretrizes da documentação do projeto: entrega acadêmica e modelo de referência. */
export interface DocSettings {
  academic: boolean
  institution: string | null
  course: string | null
  authors: string | null
  advisor: string | null
  notes: string | null
  referenceName: string | null
  /** Só o tamanho; o texto do modelo fica no servidor. */
  referenceChars: number
  configured: boolean
}

export interface DocSummary {
  type: string
  title: string
  standard: string
  version: string
  /** Seções de IA escritas / total de seções de IA. */
  written: number
  total: number
  updatedAt: string | null
}
