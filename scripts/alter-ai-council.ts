import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261011120000_ai_council: membros do conselho de IAs, as
// reuniões e as falas de cada IA. Idempotente.
async function alterAiCouncil() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.batch([
    `CREATE TABLE IF NOT EXISTS "ai_council_members" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "instructions" TEXT,
      "keyId" TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ai_council_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ai_council_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ai_council_members_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "user_ai_keys" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "ai_council_members_projectId_userId_idx" ON "ai_council_members"("projectId", "userId")`,
    `CREATE TABLE IF NOT EXISTS "ai_council_meetings" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "topic" TEXT NOT NULL,
      "rounds" INTEGER NOT NULL,
      "members" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'running',
      "summary" TEXT,
      "appliedSummary" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ai_council_meetings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "ai_council_meetings_projectId_createdAt_idx" ON "ai_council_meetings"("projectId", "createdAt")`,
    `CREATE TABLE IF NOT EXISTS "ai_council_messages" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "meetingId" TEXT NOT NULL,
      "turn" INTEGER NOT NULL,
      "round" INTEGER NOT NULL,
      "speaker" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ai_council_messages_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ai_council_meetings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ai_council_messages_meetingId_turn_key" ON "ai_council_messages"("meetingId", "turn")`,
  ]);
  console.log('Tabelas do conselho de IAs prontas.');
}

alterAiCouncil().catch((error) => {
  console.error('Erro ao aplicar a migração do conselho de IAs:', error);
  process.exitCode = 1;
});
