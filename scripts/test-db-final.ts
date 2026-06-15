// Carregar dotenv imediatamente
import 'dotenv/config';

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('TURSO_AUTH_TOKEN exists:', !!process.env.TURSO_AUTH_TOKEN);

  // Importar a função getDb após carregar o dotenv
  const { getDb } = await import('../lib/db');
  
  try {
    const db = await getDb();
    
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
  }
}

main()
  .catch(console.error);