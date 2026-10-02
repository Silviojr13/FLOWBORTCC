// Avaliação de usabilidade conduzida dentro do FlowBot (validação do TCC, RNF01).
// Compartilhado entre API, painel do participante e painel do admin.

/** Tarefas do roteiro. A ordem é a sequência sugerida ao participante. */
export const STUDY_TASKS = [
  {
    key: "primeiro-acesso",
    title: "Primeiro acesso",
    goal: "Crie sua conta e responda à pesquisa inicial. Faça o tour guiado que a plataforma oferece, ou pule se preferir explorar sozinho.",
    doneWhen: "você estiver na tela inicial do painel.",
    minutes: 5,
  },
  {
    key: "projeto-ia",
    title: "Criar um projeto com a IA",
    goal: "Pense em um projeto de robótica ou sistema embarcado. Se não tiver um em mente, use este: uma estação meteorológica com ESP32 que mede temperatura e umidade e envia os dados por Wi-Fi a cada 10 minutos. Crie o projeto conversando com o assistente até ele gerar os requisitos, e salve-os.",
    doneWhen: "o projeto aparecer na sua lista com os requisitos cadastrados.",
    minutes: 8,
  },
  {
    key: "kanban",
    title: "Planejar tarefas no Kanban",
    goal: "No projeto criado, cadastre duas tarefas, cada uma ligada a um requisito, com responsável e prazo. Depois mova uma delas para outra coluna, como “Em Progresso”.",
    doneWhen: "as duas tarefas estiverem no quadro, uma delas em andamento.",
    minutes: 6,
  },
  {
    key: "sprint",
    title: "Organizar uma sprint",
    goal: "Crie uma sprint de duas semanas com um objetivo e inclua nela as tarefas da etapa anterior.",
    doneWhen: "a sprint mostrar as duas tarefas.",
    minutes: 4,
  },
  {
    key: "custos",
    title: "Estimar os custos",
    goal: "Cadastre dois componentes do projeto com preço (por exemplo, o microcontrolador e um sensor) e um recurso de trabalho (por exemplo, você mesmo, cobrando por hora). Descubra quanto o projeto vai custar no total.",
    doneWhen: "você souber dizer o orçamento total do projeto.",
    minutes: 6,
  },
  {
    key: "diagrama",
    title: "Gerar um diagrama",
    goal: "Gere um diagrama de arquitetura do projeto (C4 de Contexto) ou o diagrama de rastreabilidade entre requisitos e tarefas.",
    doneWhen: "o diagrama aparecer desenhado na tela.",
    minutes: 3,
  },
  {
    key: "relatorio",
    title: "Exportar o relatório",
    goal: "Gere o relatório completo do projeto e exporte-o em PDF.",
    doneWhen: "o arquivo PDF for baixado no seu computador.",
    minutes: 3,
  },
] as const

export type StudyTaskKey = (typeof STUDY_TASKS)[number]["key"]

export function isStudyTaskKey(value: unknown): value is StudyTaskKey {
  return typeof value === "string" && STUDY_TASKS.some((t) => t.key === value)
}

/** Escala de Usabilidade do Sistema (Brooke, 1996), versão em português. */
export const SUS_ITEMS = [
  "Eu acho que gostaria de usar este sistema com frequência.",
  "Eu achei o sistema desnecessariamente complexo.",
  "Eu achei o sistema fácil de usar.",
  "Eu acho que precisaria da ajuda de uma pessoa com conhecimento técnico para usar este sistema.",
  "Eu achei que as várias funções do sistema estão bem integradas.",
  "Eu achei que o sistema apresenta muita inconsistência.",
  "Eu imagino que a maioria das pessoas aprenderia a usar este sistema rapidamente.",
  "Eu achei o sistema muito complicado de usar.",
  "Eu me senti muito confiante usando o sistema.",
  "Eu precisei aprender muitas coisas antes de conseguir usar o sistema.",
] as const

export const SUS_SCALE = [
  { value: 1, label: "Discordo totalmente" },
  { value: 2, label: "Discordo" },
  { value: 3, label: "Neutro" },
  { value: 4, label: "Concordo" },
  { value: 5, label: "Concordo totalmente" },
] as const

export const OPEN_QUESTIONS = [
  { key: "gostou", label: "O que você mais gostou no FlowBot?" },
  { key: "dificuldade", label: "Qual foi a maior dificuldade que você encontrou? Em qual tarefa?" },
  { key: "faltou", label: "Faltou alguma coisa que você esperava encontrar?" },
  { key: "usaria", label: "Você usaria o FlowBot em um projeto real? Por quê?" },
] as const

export const PROFILE_QUESTIONS = [
  {
    key: "area",
    label: "Qual é a sua área?",
    options: ["Estudante de graduação", "Estudante de pós-graduação", "Docente", "Profissional da indústria", "Outra"],
  },
  {
    key: "experiencia",
    label: "Experiência com projetos de robótica ou sistemas embarcados",
    options: ["Nenhuma", "Pouca", "Média", "Muita"],
  },
  {
    key: "ferramentas",
    label: "Ferramenta de gestão que você mais usou",
    options: ["Trello", "Jira", "ClickUp", "Notion", "Planilhas", "Nenhuma", "Outra"],
  },
] as const

export interface StudyAnswers {
  sus: number[]
  open: Record<string, string>
  profile: Record<string, string>
}

/**
 * Nota SUS de 0 a 100: itens ímpares contribuem (resposta − 1), pares (5 − resposta);
 * a soma é multiplicada por 2,5.
 */
export function susScore(sus: number[]): number {
  const sum = sus.reduce((acc, value, i) => acc + (i % 2 === 0 ? value - 1 : 5 - value), 0)
  return sum * 2.5
}

/** Leitura da nota pela escala adjetiva de Bangor, Kortum e Miller (2009). */
export function susRating(score: number): { label: string; tone: "ok" | "warn" | "bad" } {
  if (score >= 85) return { label: "Excelente", tone: "ok" }
  if (score >= 70) return { label: "Bom", tone: "ok" }
  if (score >= 50) return { label: "Aceitável com ressalvas", tone: "warn" }
  return { label: "Insuficiente", tone: "bad" }
}

/** Meta do RNF01: média SUS igual ou superior a 70. */
export const SUS_TARGET = 70

export const DEFAULT_STUDY = {
  title: "Avaliação de usabilidade do FlowBot",
  intro:
    "Obrigado por aceitar participar! O FlowBot é uma plataforma de gestão de projetos de robótica e sistemas embarcados: a equipe levanta requisitos conversando com uma IA, planeja tarefas e sprints, controla componentes e custos e gera diagramas e relatórios, tudo no mesmo lugar.\n\nVocê vai usar a plataforma por cerca de 35 minutos, seguindo o roteiro de tarefas, e depois responder a um questionário curto. Não existe resposta certa ou errada: quem está sendo avaliado é o FlowBot, não você. Se algo parecer confuso, essa é justamente a informação que procuramos.",
  privacy:
    "A participação é voluntária, e você pode desistir a qualquer momento, sem precisar justificar.\n\nEnquanto a avaliação estiver aberta, o FlowBot registra quais tarefas do roteiro você concluiu e quando, para calcular a taxa de conclusão e o tempo de cada tarefa. Seus projetos não são vistos pela equipe: apenas esse registro e as respostas do questionário.\n\nAs respostas são analisadas de forma anônima e aparecem no trabalho apenas de forma agregada, como médias e temas recorrentes. Os dados são usados exclusivamente neste Trabalho de Conclusão de Curso. Se quiser que sua conta e seus projetos sejam apagados depois, é só pedir à equipe.",
  contact: "Grupo 13 · Escola Politécnica · PUCPR — Lucas Bertoli, Murilo Pereira e Silvio Cezar · Orientador: Prof. Afonso Miguel",
}

/** Orientações de "como começar", exibidas no painel do participante. */
export const GETTING_STARTED = [
  "Use um computador com navegador atualizado: Chrome, Edge ou Firefox.",
  "Reserve um momento sem interrupções, cerca de 40 minutos no total.",
  "Siga as tarefas na ordem. Cada uma diz o objetivo, não o caminho: descobrir como fazer pela própria tela faz parte da avaliação.",
  "Use dados fictícios nos projetos. Não cadastre informações confidenciais.",
  "Se travar em uma tarefa por mais de 3 minutos, pode seguir para a próxima e marcá-la depois. Isso também é um resultado importante.",
  "O FlowBot marca sozinho as tarefas que reconhece. Se uma tarefa concluída não for marcada, marque você mesmo.",
  "Ao terminar as tarefas, responda ao questionário na aba Questionário.",
]

export interface StudyTaskStatus {
  key: StudyTaskKey
  title: string
  goal: string
  doneWhen: string
  minutes: number
  completedAt: string | null
  method: "auto" | "manual" | null
}

export interface StudyParticipation {
  study: {
    id: string
    title: string
    intro: string
    privacy: string
    contact: string | null
    status: string
  }
  consentAt: string
  submittedAt: string | null
  tasks: StudyTaskStatus[]
}

export interface StudyInvite {
  /** "link": aberto pelo link de convite; "email": convite enviado pelo admin para o e-mail da conta */
  source: "link" | "email"
  code: string
  title: string
  intro: string
  privacy: string
  contact: string | null
  status: string
}

export interface StudyMe {
  isAdmin: boolean
  participation: StudyParticipation | null
  invite: StudyInvite | null
}
