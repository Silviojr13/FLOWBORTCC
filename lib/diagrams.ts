// Catálogo dos diagramas de engenharia de software que o FlowBot gera. Compartilhado entre
// API e UI. O diagrama é guardado como código Mermaid; o desenho é feito na tela.

export type DiagramSource = "ia" | "dados" | "manual"

export interface DiagramTypeInfo {
  key: string
  label: string
  /** Grupo exibido no seletor. */
  group: "Arquitetura (C4)" | "Dados" | "UML" | "Gestão"
  description: string
  /**
   * "dados": montado direto do banco, sempre fiel ao estado atual do projeto.
   * "ia": escrito pelo modelo de linguagem a partir do contexto do projeto.
   */
  engine: "dados" | "ia"
  /** Sugestão exibida no campo de instruções (só para diagramas da IA). */
  placeholder?: string
}

export const DIAGRAM_TYPES: DiagramTypeInfo[] = [
  {
    key: "c4-context",
    label: "C4 · Contexto",
    group: "Arquitetura (C4)",
    description: "Nível 1: o sistema, quem o usa e com quais sistemas externos ele conversa.",
    engine: "ia",
  },
  {
    key: "c4-container",
    label: "C4 · Contêineres",
    group: "Arquitetura (C4)",
    description: "Nível 2: aplicações, firmware, APIs e bancos que formam o sistema.",
    engine: "ia",
  },
  {
    key: "c4-component",
    label: "C4 · Componentes",
    group: "Arquitetura (C4)",
    description: "Nível 3: os módulos internos de um contêiner e suas responsabilidades.",
    engine: "ia",
    placeholder: "Ex.: detalhe o firmware do microcontrolador",
  },
  {
    key: "er",
    label: "Modelo relacional (ER)",
    group: "Dados",
    description: "Entidades, atributos e cardinalidades dos dados que o sistema guarda.",
    engine: "ia",
  },
  {
    key: "class",
    label: "Diagrama de classes",
    group: "UML",
    description: "Classes, atributos, métodos e relações (herança, composição, associação).",
    engine: "ia",
    placeholder: "Ex.: foque no controle dos motores",
  },
  {
    key: "use-case",
    label: "Casos de uso",
    group: "UML",
    description: "Atores e o que cada um consegue fazer no sistema, a partir dos requisitos.",
    engine: "ia",
  },
  {
    key: "sequence",
    label: "Sequência",
    group: "UML",
    description: "Troca de mensagens entre as partes do sistema em um fluxo específico.",
    engine: "ia",
    placeholder: "Ex.: fluxo de parada de emergência",
  },
  {
    key: "state",
    label: "Máquina de estados",
    group: "UML",
    description: "Estados do sistema e os eventos que provocam cada transição.",
    engine: "ia",
    placeholder: "Ex.: estados do braço durante a separação",
  },
  {
    key: "traceability",
    label: "Rastreabilidade",
    group: "Gestão",
    description: "Requisitos ligados às funcionalidades, tarefas e componentes do projeto.",
    engine: "dados",
  },
  {
    key: "gantt",
    label: "Cronograma (Gantt)",
    group: "Gestão",
    description: "Sprints e prazos das tarefas ao longo do tempo.",
    engine: "dados",
  },
]

export const DIAGRAM_GROUPS = ["Arquitetura (C4)", "Dados", "UML", "Gestão"] as const

export function getDiagramType(key: string): DiagramTypeInfo | undefined {
  return DIAGRAM_TYPES.find((t) => t.key === key)
}

export interface Diagram {
  id: string
  title: string
  type: string
  code: string
  instructions: string | null
  source: DiagramSource
  projectId: string
  createdAt: string
  updatedAt: string
}
