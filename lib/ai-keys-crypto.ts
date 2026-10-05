import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/**
 * Criptografia das chaves de API das IAs (AES-256-GCM). O segredo vem de AI_KEYS_SECRET ou,
 * na falta dela, do AUTH_SECRET que o login já usa. Trocar esse segredo invalida as chaves
 * salvas: a pessoa precisa conectar a IA de novo.
 *
 * Formato salvo: "v1:<iv>:<tag>:<texto cifrado>", tudo em base64.
 */

function secret(): string {
  const value = process.env.AI_KEYS_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!value) throw new Error("Defina AI_KEYS_SECRET (ou AUTH_SECRET) para guardar chaves de IA.")
  return value
}

/** Chave de 32 bytes derivada do segredo, separada da usada pelo login. */
function encryptionKey(): Buffer {
  return createHash("sha256").update(`flowbot:user-ai-keys:${secret()}`).digest()
}

export function encryptionReady(): boolean {
  return Boolean(process.env.AI_KEYS_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
}

export function encryptApiKey(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v1", iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":")
}

/** Devolve null quando a chave não abre (segredo trocado ou valor adulterado). */
export function decryptApiKey(stored: string): string | null {
  const [version, iv, tag, data] = stored.split(":")
  if (version !== "v1" || !iv || !tag || !data) return null
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"))
    decipher.setAuthTag(Buffer.from(tag, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

/** Final da chave para a pessoa reconhecer qual é, sem expor o resto. */
export function keyHint(plain: string): string {
  return `…${plain.slice(-4)}`
}
