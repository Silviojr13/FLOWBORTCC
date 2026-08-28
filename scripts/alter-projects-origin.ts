import 'dotenv/config';
import { createClient } from '@libsql/client';

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const info = await client.execute('PRAGMA table_info(projects)');
  const hasColumn = info.rows.some((row) => row.name === 'origin');

  if (hasColumn) {
    console.log('Coluna origin já existe em projects.');
    return;
  }

  await client.execute(`
    ALTER TABLE projects ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual';
  `);
  console.log('Coluna origin adicionada a projects.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
