import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261003120000_resources_and_component_domain: tabela de
// recursos do projeto e o campo Hardware/Software dos componentes. Idempotente.
async function alterResources() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const info = await client.execute('PRAGMA table_info(hardware_components)');
    if (info.rows.some((r) => r.name === 'domain')) {
      console.log('Coluna domain já existe em hardware_components.');
    } else {
      await client.execute(
        `ALTER TABLE hardware_components ADD COLUMN domain TEXT NOT NULL DEFAULT 'Hardware'`
      );
      console.log('Coluna domain adicionada em hardware_components.');
    }

    await client.execute(`CREATE TABLE IF NOT EXISTS "resources" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "type" TEXT NOT NULL,
      "availability" TEXT NOT NULL DEFAULT 'disponivel',
      "costModel" TEXT NOT NULL DEFAULT 'unico',
      "unitCost" REAL NOT NULL DEFAULT 0,
      "quantity" REAL NOT NULL DEFAULT 1,
      "projectId" TEXT NOT NULL,
      "requirementId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "resources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "resources_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`);
    await client.execute(`CREATE INDEX IF NOT EXISTS "resources_projectId_idx" ON "resources"("projectId")`);
    console.log('Tabela resources pronta.');
  } catch (error) {
    console.error('Erro ao aplicar a migração de recursos:', error);
    process.exitCode = 1;
  }
}

alterResources().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
