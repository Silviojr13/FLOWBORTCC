import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261001120000_guided_tour: controle do tour guiado da
// primeira sessão e marcação do projeto de exemplo. Idempotente.
async function alterTourGuiado() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  async function addColumn(table: string, column: string, definition: string) {
    const info = await client.execute(`PRAGMA table_info(${table})`);
    if (info.rows.some((r) => r.name === column)) {
      console.log(`Coluna ${column} já existe em ${table}.`);
      return;
    }
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Coluna ${column} adicionada em ${table}.`);
  }

  try {
    await addColumn('users', 'tourCompletedAt', 'DATETIME');
    await addColumn('projects', 'isTutorial', 'BOOLEAN NOT NULL DEFAULT 0');

    console.log('Migração do tour guiado concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao aplicar a migração do tour guiado:', error);
    process.exitCode = 1;
  }
}

alterTourGuiado();
