import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261009120000_user_ai_keys: chaves de API das IAs que cada
// pessoa conecta em "Minhas IAs". Idempotente.
async function alterUserAiKeys() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.batch([
    `CREATE TABLE IF NOT EXISTS "user_ai_keys" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "label" TEXT,
      "model" TEXT NOT NULL,
      "encryptedKey" TEXT NOT NULL,
      "keyHint" TEXT NOT NULL,
      "useInAssistant" BOOLEAN NOT NULL DEFAULT false,
      "lastTestedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "user_ai_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "user_ai_keys_userId_idx" ON "user_ai_keys"("userId")`,
  ]);
  console.log('Tabela user_ai_keys pronta.');
}

alterUserAiKeys().catch((error) => {
  console.error('Erro ao aplicar a migração das chaves de IA:', error);
  process.exitCode = 1;
});
