import { db } from '../lib/db';

async function testConnection() {
  try {
    console.log('Testando conexão com o banco de dados...');
    
    // Testar a conexão
    await db.$connect();
    console.log('✅ Conexão com o banco de dados bem-sucedida!');
    
    // Testar uma operação simples
    const userCount = await db.user.count();
    console.log(`Número de usuários no banco: ${userCount}`);
    
    await db.$disconnect();
    console.log('Conexão encerrada com sucesso.');
  } catch (error) {
    console.error('❌ Erro na conexão com o banco de dados:', error);
  }
}

testConnection();