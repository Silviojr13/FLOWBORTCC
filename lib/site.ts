// Endereço público do FlowBot. Links compartilhados (como o convite da avaliação) sempre
// usam este domínio, mesmo quando o admin está no localhost ou num deploy de preview.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://flowbottcc.vercel.app").replace(/\/+$/, "")

export function inviteUrl(code: string): string {
  return `${SITE_URL}/avaliacao/${code}`
}
