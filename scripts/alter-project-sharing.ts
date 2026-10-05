import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261008120000_project_sharing: membros do projeto (com cargo)
// e convites por e-mail ou link. Idempotente.
async function alterProjectSharing() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.batch([
    `CREATE TABLE IF NOT EXISTS "project_members" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'visitante',
        "canSeeCosts" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "project_invitations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "email" TEXT,
        "invitedById" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" DATETIME NOT NULL,
        "acceptedAt" DATETIME,
        "declinedAt" DATETIME,
        "revokedAt" DATETIME,
        CONSTRAINT "project_invitations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "project_members_projectId_userId_key" ON "project_members"("projectId", "userId")`,
    `CREATE INDEX IF NOT EXISTS "project_members_userId_idx" ON "project_members"("userId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "project_invitations_code_key" ON "project_invitations"("code")`,
    `CREATE INDEX IF NOT EXISTS "project_invitations_projectId_idx" ON "project_invitations"("projectId")`,
    `CREATE INDEX IF NOT EXISTS "project_invitations_email_idx" ON "project_invitations"("email")`,
  ]);
  console.log('Tabelas project_members e project_invitations prontas.');
}

alterProjectSharing().catch((error) => {
  console.error('Erro ao aplicar a migração de compartilhamento:', error);
  process.exitCode = 1;
});
