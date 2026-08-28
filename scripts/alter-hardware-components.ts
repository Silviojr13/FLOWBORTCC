import 'dotenv/config';
import { createClient } from '@libsql/client';

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const info = await client.execute('PRAGMA table_info(hardware_components)');
  const hasColumn = info.rows.some((row) => row.name === 'requirementId');

  if (hasColumn) {
    console.log('Coluna requirementId já existe em hardware_components.');
    return;
  }

  await client.execute(`
    ALTER TABLE hardware_components ADD COLUMN requirementId TEXT
    REFERENCES requirements(id) ON DELETE SET NULL;
  `);
  console.log('Coluna requirementId adicionada a hardware_components.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
