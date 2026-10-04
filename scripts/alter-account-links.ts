import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261006120000_pending_account_links: associação pendente
// entre o login com Google e uma conta já criada com e-mail e senha. Idempotente.
async function alterAccountLinks() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.batch([
    `CREATE TABLE IF NOT EXISTS "pending_account_links" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "tokenHash" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "providerAccountId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "expiresAt" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "pending_account_links_tokenHash_key" ON "pending_account_links"("tokenHash")`,
  ]);
  const columns = await client.execute('PRAGMA table_info(pending_account_links)');
  if (!columns.rows.some((r) => r.name === 'attempts')) {
    await client.execute('ALTER TABLE pending_account_links ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
  }
  console.log('Tabela pending_account_links pronta.');
}

alterAccountLinks().catch((error) => {
  console.error('Erro ao aplicar a migração de associação de contas:', error);
  process.exitCode = 1;
});
