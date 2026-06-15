import 'dotenv/config';
import { createClient } from '@libsql/client';

async function testConnection() {
  console.log('Tentando conectar ao banco Turso...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('TURSO_AUTH_TOKEN exists:', !!process.env.TURSO_AUTH_TOKEN);

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    console.log('Executando consulta de teste...');
    const result = await client.execute('SELECT 1 as test');
    console.log('Conexão bem-sucedida!');
    console.log('Resultado:', result.rows);
  } catch (error) {
    console.error('Erro na conexão:', error);
  } finally {
    console.log('Conexão finalizada.');
  }
}

testConnection();