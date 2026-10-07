import { decryptApiKey, encryptApiKey } from "../lib/ai-keys-crypto";

/**
 * Troca o segredo que protege as chaves de "Minhas IAs" sem que ninguém perca a sua: abre
 * cada chave com o segredo antigo e grava de novo com o novo. Por padrão só confere; grava
 * com --aplicar.
 *
 *   OLD_AI_KEYS_SECRET=... NEW_AI_KEYS_SECRET=... npm run script:rotate-ai-keys-secret
 *   OLD_AI_KEYS_SECRET=... NEW_AI_KEYS_SECRET=... npm run script:rotate-ai-keys-secret -- --aplicar
 *
 * O segredo antigo é o AI_KEYS_SECRET em uso (ou, sem ele, o AUTH_SECRET). Depois de aplicar,
 * defina AI_KEYS_SECRET com o novo valor na Vercel.
 */

async function main() {
  const oldSecret = process.env.OLD_AI_KEYS_SECRET;
  const newSecret = process.env.NEW_AI_KEYS_SECRET;
  if (!oldSecret || !newSecret) throw new Error("Defina OLD_AI_KEYS_SECRET e NEW_AI_KEYS_SECRET.");
  if (oldSecret === newSecret) throw new Error("O segredo novo é igual ao antigo.");
  const apply = process.argv.includes("--aplicar");

  const { tursoDb: db } = await import("../lib/turso-db");
  const rows = await db.userAiKey.findMany({ select: { id: true, encryptedKey: true } });

  const updates: { id: string; encryptedKey: string }[] = [];
  let unreadable = 0;
  for (const row of rows) {
    const plain = decryptApiKey(row.encryptedKey, oldSecret);
    if (plain === null) {
      // Já estava ilegível antes da troca (segredo trocado no passado): fica como está.
      unreadable++;
      continue;
    }
    const encryptedKey = encryptApiKey(plain, newSecret);
    if (decryptApiKey(encryptedKey, newSecret) !== plain) throw new Error(`Falha ao conferir a chave ${row.id}.`);
    updates.push({ id: row.id, encryptedKey });
  }

  console.log(`Chaves: ${rows.length} · recriptografáveis: ${updates.length} · já ilegíveis: ${unreadable}`);
  if (!apply) {
    console.log("Nada foi gravado. Rode de novo com --aplicar para gravar.");
  } else {
    await db.$transaction(updates.map((u) => db.userAiKey.update({ where: { id: u.id }, data: { encryptedKey: u.encryptedKey } })));
    console.log(`${updates.length} chave(s) gravada(s) com o segredo novo. Agora defina AI_KEYS_SECRET na Vercel.`);
  }
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
