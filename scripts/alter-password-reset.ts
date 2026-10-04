import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261005120000_password_reset: links de recuperação de senha.
// Idempotente.
async function alterPasswordReset() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.batch([
    `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "usedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash")`,
    `CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId")`,
  ]);
  console.log('Tabela password_reset_tokens pronta.');
}

alterPasswordReset().catch((error) => {
  console.error('Erro ao aplicar a migração de recuperação de senha:', error);
  process.exitCode = 1;
});
