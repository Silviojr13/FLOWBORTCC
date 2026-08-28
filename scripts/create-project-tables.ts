import 'dotenv/config';
import { createClient } from '@libsql/client';

async function createProjectTables() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        startDate TEXT,
        endDate TEXT,
        userId TEXT NOT NULL,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('Tabela projects criada.');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS requirements (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Em Aberto',
        level TEXT,
        projectId TEXT NOT NULL,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
    console.log('Tabela requirements criada.');

    await client.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_requirements_project_code
      ON requirements(projectId, code);
    `);
    console.log('Índice único para requirements criado.');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS requirement_history (
        id TEXT PRIMARY KEY,
        requirementId TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        level TEXT,
        changedAt TEXT,
        FOREIGN KEY (requirementId) REFERENCES requirements(id) ON DELETE CASCADE
      );
    `);
    console.log('Tabela requirement_history criada.');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'Backlog',
        projectId TEXT NOT NULL,
        requirementId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (requirementId) REFERENCES requirements(id) ON DELETE SET NULL
      );
    `);
    console.log('Tabela tasks criada.');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS hardware_components (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        unitPrice REAL NOT NULL DEFAULT 0,
        projectId TEXT NOT NULL,
        requirementId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (requirementId) REFERENCES requirements(id) ON DELETE SET NULL
      );
    `);
    console.log('Tabela hardware_components criada.');

    console.log('Todas as tabelas do módulo de projetos foram criadas com sucesso!');
  } catch (error) {
    console.error('Erro ao criar tabelas:', error);
    process.exitCode = 1;
  }
}

createProjectTables();
