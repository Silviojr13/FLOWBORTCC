import { createHash, randomBytes } from "node:crypto"
import { tursoDb } from "./turso-db"

/**
 * Tokens pessoais para ferramentas externas (o Claude Code, pelo servidor MCP em /api/mcp).
 * O token tem 256 bits aleatórios; o banco guarda só o hash SHA-256 e um trecho para a
 * pessoa reconhecer qual é. Quem tem o token age como a pessoa, com as permissões dela.
 */

const PREFIX = "fbt_"

export function generateApiToken(): { token: string; hash: string; hint: string } {
  const token = `${PREFIX}${randomBytes(32).toString("base64url")}`
  return { token, hash: hashApiToken(token), hint: `${token.slice(0, 8)}…${token.slice(-4)}` }
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Último uso é gravado no máximo a cada 5 minutos, para não escrever a cada chamada. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000

/** Dono do token do cabeçalho Authorization: Bearer, ou null se faltar ou não valer. */
export async function userFromBearer(
  authorization: string | null
): Promise<{ id: string; name: string | null } | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? "")
  if (!match || !match[1].startsWith(PREFIX) || match[1].length > 100) return null

  const row = await tursoDb.apiToken.findUnique({
    where: { tokenHash: hashApiToken(match[1]) },
    select: { id: true, lastUsedAt: true, user: { select: { id: true, name: true } } },
  })
  if (!row) return null

  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await tursoDb.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  }
  return row.user
}
