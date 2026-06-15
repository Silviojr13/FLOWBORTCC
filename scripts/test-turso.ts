import 'dotenv/config';
import { createClient } from '@libsql/client';

async function testTursoClient() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  
  try {
    // Tentar criar cliente do LibSQL
    const turso = createClient({
      url: process.env.DATABASE_URL!,
    });
    
    console.log('✅ Cliente do LibSQL criado com sucesso!');
    
    // Testar a conexão
    const result = await turso.execute('SELECT 1 as test');
    console.log('✅ Conexão com o banco de dados bem-sucedida!');
    console.log('Resultado:', result.rows);
    
    // Testar se as tabelas existem
    const tables = await turso.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name IN ('users', 'accounts', 'sessions', 'chats', 'messages')
    `);
    console.log('Tabelas encontradas:', tables.rows.map((row: any) => row.name));
    
  } catch (error) {
    console.error('❌ Erro ao criar cliente do LibSQL:', error);
  }
}

testTursoClient();