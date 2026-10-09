import 'dotenv/config';
import { createClient } from '@libsql/client';

// Aplica no Turso a migração 20261013120000_study_project: a avaliação de usabilidade passa a
// pertencer a um projeto. Idempotente. Com --projeto <id>, liga ao projeto as avaliações que
// ainda não têm projeto.
//
//   npm run script:alter-study-project
//   npm run script:alter-study-project -- --projeto <projectId>
async function alterStudyProject() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const columns = await client.execute(`PRAGMA table_info("studies")`);
  if (!columns.rows.some((c) => c.name === 'projectId')) {
    await client.execute(
      `ALTER TABLE "studies" ADD COLUMN "projectId" TEXT REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    console.log('Coluna studies.projectId criada.');
  } else {
    console.log('Coluna studies.projectId já existia.');
  }
  await client.execute(`CREATE INDEX IF NOT EXISTS "studies_projectId_idx" ON "studies"("projectId")`);

  const flag = process.argv.indexOf('--projeto');
  const projectId = flag >= 0 ? process.argv[flag + 1] : undefined;
  if (projectId) {
    const project = await client.execute({ sql: `SELECT name FROM "projects" WHERE id = ?`, args: [projectId] });
    if (project.rows.length === 0) throw new Error(`Projeto ${projectId} não encontrado.`);
    const linked = await client.execute({
      sql: `UPDATE "studies" SET "projectId" = ? WHERE "projectId" IS NULL`,
      args: [projectId],
    });
    console.log(`${linked.rowsAffected} avaliação(ões) ligada(s) ao projeto "${project.rows[0].name}".`);
  }
}

alterStudyProject().catch((error) => {
  console.error('Erro ao ligar as avaliações aos projetos:', error);
  process.exitCode = 1;
});
