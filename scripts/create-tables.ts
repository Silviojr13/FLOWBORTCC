import 'dotenv/config';
import { createClient } from '@libsql/client';

async function createTables() {
  console.log('Conectando ao banco Turso...');
  
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    // Criar tabela de usuários
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        emailVerified TEXT,
        image TEXT,
        provider TEXT,
        providerId TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );
    `);
    console.log('Tabela users criada.');

    // Criar tabela de contas
    await client.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        providerAccountId TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at INTEGER,
        token_type TEXT,
        scope TEXT,
        id_token TEXT,
        session_state TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('Tabela accounts criada.');

    // Criar índice único para provider/providerAccountId
    await client.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_provider_unique 
      ON accounts(provider, providerAccountId);
    `);
    console.log('Índice único para accounts criado.');

    // Criar tabela de sessões
    await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        sessionToken TEXT UNIQUE,
        userId TEXT NOT NULL,
        expires TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('Tabela sessions criada.');

    // Criar tabela de chats
    await client.execute(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        userId TEXT NOT NULL,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      );
    `);
    console.log('Tabela chats criada.');

    // Criar tabela de mensagens
    await client.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT,
        FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
      );
    `);
    console.log('Tabela messages criada.');

    console.log('Todas as tabelas criadas com sucesso!');
  } catch (error) {
    console.error('Erro ao criar tabelas:', error);
  } finally {
    console.log('Conexão finalizada.');
  }
}

createTables();