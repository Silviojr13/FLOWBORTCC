import 'dotenv/config';
import { createClient } from '@libsql/client';

/**
 * Aplica no Turso a migração 20261004120000_usability_studies (papel de admin, progresso
 * dos tutoriais e tabelas da avaliação de usabilidade). Idempotente. Com um e-mail,
 * promove a conta a admin:
 *
 *   npm run script:alter-usability-studies
 *   npm run script:alter-usability-studies -- admin@email.com
 */
async function alterUsabilityStudies() {
  const adminEmail = process.argv.find((arg) => arg.includes('@'));
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const users = await client.execute('PRAGMA table_info(users)');
  if (users.rows.some((r) => r.name === 'role')) {
    console.log('Coluna role já existe em users.');
  } else {
    await client.execute(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
    console.log('Coluna role adicionada em users.');
  }
  if (users.rows.some((r) => r.name === 'tutorialProgress')) {
    console.log('Coluna tutorialProgress já existe em users.');
  } else {
    await client.execute(`ALTER TABLE users ADD COLUMN tutorialProgress TEXT`);
    console.log('Coluna tutorialProgress adicionada em users.');
  }

  await client.batch([
    `CREATE TABLE IF NOT EXISTS "studies" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "intro" TEXT NOT NULL,
      "privacy" TEXT NOT NULL,
      "contact" TEXT,
      "inviteCode" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'aberta',
      "createdById" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "studies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "study_participants" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "studyId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "consentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "submittedAt" DATETIME,
      "answers" TEXT,
      "susScore" REAL,
      CONSTRAINT "study_participants_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "studies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "study_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "study_task_progress" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "participantId" TEXT NOT NULL,
      "taskKey" TEXT NOT NULL,
      "method" TEXT NOT NULL,
      "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "study_task_progress_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "study_participants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "studies_inviteCode_key" ON "studies"("inviteCode")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "study_participants_studyId_userId_key" ON "study_participants"("studyId", "userId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "study_task_progress_participantId_taskKey_key" ON "study_task_progress"("participantId", "taskKey")`,
  ]);
  console.log('Tabelas da avaliação de usabilidade prontas.');

  if (adminEmail) {
    const result = await client.execute({
      sql: `UPDATE users SET role = 'admin' WHERE email = ?`,
      args: [adminEmail],
    });
    console.log(
      result.rowsAffected > 0
        ? `${adminEmail} agora é admin.`
        : `Nenhuma conta encontrada com o e-mail ${adminEmail}.`
    );
  }
}

alterUsabilityStudies().catch((error) => {
  console.error('Erro ao aplicar a migração da avaliação:', error);
  process.exitCode = 1;
});
