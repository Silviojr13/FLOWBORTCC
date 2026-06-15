// Carregar dotenv imediatamente
import 'dotenv/config';

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('TURSO_AUTH_TOKEN exists:', !!process.env.TURSO_AUTH_TOKEN);
  console.log('TURSO_AUTH_TOKEN length:', process.env.TURSO_AUTH_TOKEN?.length);

  // Importar os módulos após carregar o dotenv
  const { createClient } = await import("@libsql/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const { PrismaClient } = await import("@prisma/client");

  // Criar cliente do LibSQL com as credenciais do ambiente
  const turso = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Criar adapter do Prisma para LibSQL
  const adapter = new PrismaLibSql(turso);

  // Criar PrismaClient com o adapter
  const db = new PrismaClient({
    adapter,
    log: ["query", "info", "warn", "error"],
  });

  try {
    // Testar a conexão
    await db.$connect();
    console.log('✅ Conexão com o banco de dados bem-sucedida!');

    // Testar uma consulta simples
    const result = await db.$queryRaw`SELECT 1 as test`;
    console.log('Resultado da consulta:', result);

    // Testar consultando se há usuários (mesmo que não existam)
    const userCount = await db.user.count();
    console.log(`Número de usuários no banco: ${userCount}`);
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco de dados:', error);
  } finally {
    await db.$disconnect();
  }
}

main()
  .catch(console.error);