import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261012120000_project_docs: documentos de engenharia do
// projeto (aba Documentação) e as diretrizes da documentação. Idempotente.
async function alterProjectDocs() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.batch([
    `CREATE TABLE IF NOT EXISTS "project_documents" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "version" TEXT NOT NULL DEFAULT '0.1',
      "sections" TEXT NOT NULL DEFAULT '{}',
      "revisions" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "project_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "project_documents_projectId_type_key" ON "project_documents"("projectId", "type")`,
    `CREATE TABLE IF NOT EXISTS "project_doc_settings" (
      "projectId" TEXT NOT NULL PRIMARY KEY,
      "academic" BOOLEAN NOT NULL DEFAULT false,
      "institution" TEXT,
      "course" TEXT,
      "authors" TEXT,
      "advisor" TEXT,
      "notes" TEXT,
      "referenceName" TEXT,
      "referenceText" TEXT,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "project_doc_settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
  ]);
  console.log('Tabelas da documentação prontas.');
}

alterProjectDocs().catch((error) => {
  console.error('Erro ao aplicar a migração da documentação:', error);
  process.exitCode = 1;
});
