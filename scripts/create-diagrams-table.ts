import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261002120000_project_diagrams: tabela dos diagramas de
// engenharia de software de cada projeto. Idempotente.
async function createDiagramsTable() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS "diagrams" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "instructions" TEXT,
      "source" TEXT NOT NULL DEFAULT 'ia',
      "projectId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "diagrams_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "diagrams_projectId_idx" ON "diagrams"("projectId")`);

    // Bancos que já tinham a tabela antes da coluna de instruções.
    const columns = await client.execute(`PRAGMA table_info(diagrams)`);
    if (!columns.rows.some((r) => r.name === 'instructions')) {
      await client.execute(`ALTER TABLE diagrams ADD COLUMN instructions TEXT`);
      console.log('Coluna instructions adicionada.');
    }

    console.log('Tabela diagrams pronta.');
  } catch (error) {
    console.error('Erro ao criar a tabela diagrams:', error);
    process.exitCode = 1;
  }
}

createDiagramsTable().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
