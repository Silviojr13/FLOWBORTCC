import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261007120000_task_participants: participantes de uma tarefa
// além do responsável principal. Idempotente.
async function alterTaskParticipants() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.batch([
    `CREATE TABLE IF NOT EXISTS "task_participants" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "taskId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "task_participants_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "task_participants_taskId_idx" ON "task_participants"("taskId")`,
  ]);
  console.log('Tabela task_participants pronta.');
}

alterTaskParticipants().catch((error) => {
  console.error('Erro ao aplicar a migração de participantes da tarefa:', error);
  process.exitCode = 1;
});
