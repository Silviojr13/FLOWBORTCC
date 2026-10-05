/**
 * Documentação de engenharia do projeto: o catálogo de documentos, cada um seguindo a sua
 * norma internacional (ISO/IEC/IEEE), adotadas no Brasil pela ABNT com o mesmo conteúdo.
 *
 * Cada seção é de um de três tipos:
 * - "ia": texto escrito pela IA a partir dos dados do projeto (e editável);
 * - "dados": tabela montada direto do banco, sempre igual ao estado atual do projeto;
 * - "diagrama": o diagrama salvo na aba Diagramas.
 */

import catalog from "./docs-catalog.json"

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

// O catálogo (documentos, normas e seções) é dado, não código: fica em docs-catalog.json.
export const DOC_TYPES = catalog as DocTypeDef[]

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
