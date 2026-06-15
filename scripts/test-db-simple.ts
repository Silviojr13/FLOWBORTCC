import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import path from 'path';

async function testConnection() {
  try {
    // Obter o caminho absoluto do banco de dados
    const dbPath = path.resolve('./flowbot.db');
    console.log('Conectando ao banco de dados:', `file:${dbPath}`);
    
    // Criar cliente libsql com base no caminho absoluto do banco de dados
    const libsqlClient = createClient({
      url: `file:${dbPath}`,
    });

    // Criar adaptador usando o cliente libsql
    const adapter = new PrismaLibSql(libsqlClient);

    // Criar uma instância do PrismaClient com o adaptador
    const prisma = new PrismaClient({ adapter });

    // Testar a conexão pingando o banco de dados
    await prisma.$connect();
    console.log('Conexão com o banco de dados bem-sucedida!');

    // Testar consultando se há usuários (mesmo que não existam)
    const userCount = await prisma.user.count();
    console.log(`Número de usuários no banco: ${userCount}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
  }
}

testConnection();