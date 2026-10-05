import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261010120000_dev_bridge: tokens pessoais do servidor MCP e
// o andamento do desenvolvimento registrado pelo Claude Code. Idempotente.
async function alterDevBridge() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.batch([
    `CREATE TABLE IF NOT EXISTS "api_tokens" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "tokenHint" TEXT NOT NULL,
      "lastUsedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "api_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "api_tokens_tokenHash_key" ON "api_tokens"("tokenHash")`,
    `CREATE INDEX IF NOT EXISTS "api_tokens_userId_idx" ON "api_tokens"("userId")`,
    `CREATE TABLE IF NOT EXISTS "dev_notes" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "taskId" TEXT,
      "authorId" TEXT,
      "source" TEXT NOT NULL DEFAULT 'Claude Code',
      "kind" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "link" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "dev_notes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "dev_notes_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "dev_notes_projectId_createdAt_idx" ON "dev_notes"("projectId", "createdAt")`,
  ]);
  console.log('Tabelas api_tokens e dev_notes prontas.');
}

alterDevBridge().catch((error) => {
  console.error('Erro ao aplicar a migração da ponte com o Claude:', error);
  process.exitCode = 1;
});
