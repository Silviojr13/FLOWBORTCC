import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20260928100000_chat_project: liga a conversa do assistente
// ao projeto criado a partir dela. Idempotente.
async function alterChatsProject() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const cols = await client.execute(`PRAGMA table_info(chats)`);
    const hasProjectId = cols.rows.some((r) => r.name === 'projectId');

    if (hasProjectId) {
      console.log('Coluna projectId já existe em chats.');
    } else {
      await client.execute(
        `ALTER TABLE chats ADD COLUMN projectId TEXT REFERENCES projects(id) ON DELETE SET NULL`
      );
      console.log('Coluna projectId adicionada em chats.');
    }

    for (const sql of [
      `CREATE INDEX IF NOT EXISTS chats_userId_idx ON chats(userId)`,
      `CREATE INDEX IF NOT EXISTS chats_projectId_idx ON chats(projectId)`,
    ]) {
      await client.execute(sql);
    }
    console.log('Índices criados.');

    console.log('Migração do chat concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao alterar a tabela chats:', error);
    process.exitCode = 1;
  }
}

alterChatsProject();
