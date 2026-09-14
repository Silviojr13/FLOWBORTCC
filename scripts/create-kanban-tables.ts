import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20260914120000_kanban_tasks_sprints (mesmo padrão dos
// demais scripts create-*/alter-*). Recria `tasks` — aborta se a tabela antiga tiver dados.
async function createKanbanTables() {
  console.log('Conectando ao banco Turso...');

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const hasOldTasks = await client.execute(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'`
    );
    if (hasOldTasks.rows.length > 0) {
      const cols = await client.execute(`PRAGMA table_info(tasks)`);
      const alreadyMigrated = cols.rows.some((r) => r.name === 'columnId');
      if (alreadyMigrated) {
        console.log('Tabela tasks já está no modelo novo; nada a recriar.');
      } else {
        const count = await client.execute(`SELECT COUNT(*) AS n FROM tasks`);
        const n = Number(count.rows[0].n);
        if (n > 0) {
          throw new Error(
            `A tabela tasks antiga tem ${n} registro(s). Migre-os manualmente antes de rodar este script.`
          );
        }
        await client.execute(`DROP TABLE tasks`);
        console.log('Tabela tasks antiga (vazia) removida.');
      }
    }

    await client.execute(`
      CREATE TABLE IF NOT EXISTS kanban_columns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        isDone BOOLEAN NOT NULL DEFAULT 0,
        wipLimit INTEGER,
        projectId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
    console.log('Tabela kanban_columns criada.');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS sprints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        goal TEXT,
        startDate DATETIME NOT NULL,
        endDate DATETIME NOT NULL,
        projectId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
    console.log('Tabela sprints criada.');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'Média',
        assignee TEXT,
        dueDate DATETIME,
        "order" INTEGER NOT NULL DEFAULT 0,
        columnId TEXT NOT NULL,
        projectId TEXT NOT NULL,
        requirementId TEXT,
        featureId TEXT,
        sprintId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME,
        FOREIGN KEY (columnId) REFERENCES kanban_columns(id) ON DELETE RESTRICT,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (requirementId) REFERENCES requirements(id) ON DELETE SET NULL,
        FOREIGN KEY (featureId) REFERENCES features(id) ON DELETE SET NULL,
        FOREIGN KEY (sprintId) REFERENCES sprints(id) ON DELETE SET NULL
      );
    `);
    console.log('Tabela tasks criada.');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS task_history (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        fromColumn TEXT,
        toColumn TEXT NOT NULL,
        changedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);
    console.log('Tabela task_history criada.');

    for (const sql of [
      `CREATE INDEX IF NOT EXISTS kanban_columns_projectId_idx ON kanban_columns(projectId)`,
      `CREATE INDEX IF NOT EXISTS tasks_projectId_idx ON tasks(projectId)`,
      `CREATE INDEX IF NOT EXISTS tasks_columnId_idx ON tasks(columnId)`,
      `CREATE INDEX IF NOT EXISTS sprints_projectId_idx ON sprints(projectId)`,
      `CREATE INDEX IF NOT EXISTS task_history_taskId_idx ON task_history(taskId)`,
    ]) {
      await client.execute(sql);
    }
    console.log('Índices criados.');

    console.log('Tabelas do Kanban criadas com sucesso!');
  } catch (error) {
    console.error('Erro ao criar tabelas do Kanban:', error);
    process.exitCode = 1;
  }
}

createKanbanTables();
