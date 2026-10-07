import { spawnSync } from "node:child_process";
import path from "node:path";
import { hash } from "bcrypt";

/**
 * Monta o ambiente de desenvolvimento local: um banco SQLite com todas as tabelas do schema,
 * uma conta de teste e o projeto de exemplo do tour. Nada aqui toca o banco de produção.
 *
 *   cp .env.example .env      (preencha AUTH_SECRET e GROQ_API_KEY)
 *   npm run dev:setup
 *   npm run dev
 *
 * Rodar de novo é seguro: as tabelas são sincronizadas e a conta e o projeto não duplicam.
 */

const DEV_EMAIL = "dev@flowbot.local";
const DEV_PASSWORD = "flowbot-dev";

async function main() {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  // Trava de segurança: este script só escreve num arquivo local, nunca no Turso.
  if (!url.startsWith("file:")) {
    console.error(`DATABASE_URL aponta para "${url.split("?")[0].slice(0, 40)}…", que não é um banco local.`);
    console.error('Para desenvolver, use DATABASE_URL="file:./dev.db" no seu .env.');
    process.exit(1);
  }
  const file = path.resolve(url.slice("file:".length));
  const absoluteUrl = `file:${file}`;
  process.env.DATABASE_URL = absoluteUrl;
  delete process.env.TURSO_AUTH_TOKEN;

  console.log(`Banco local: ${file}`);
  const push = spawnSync("npx", ["prisma", "db", "push", "--config", "prisma/dev.config.ts"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: absoluteUrl },
  });
  if (push.status !== 0) process.exit(push.status ?? 1);

  // Importados só agora: o cliente do banco lê DATABASE_URL quando é carregado.
  const { tursoDb: db } = await import("../lib/turso-db");
  const { createTutorialProject } = await import("../lib/tour-seed");

  const now = new Date();
  const user = await db.user.upsert({
    where: { email: DEV_EMAIL },
    update: {},
    create: {
      name: "Dev FlowBot",
      email: DEV_EMAIL,
      password: await hash(DEV_PASSWORD, 10),
      onboardingCompletedAt: now,
      tourCompletedAt: now,
    },
  });
  await createTutorialProject(user.id);
  await db.$disconnect();

  console.log("\nAmbiente pronto. Rode `npm run dev` e entre em http://localhost:3000 com:");
  console.log(`  e-mail: ${DEV_EMAIL}`);
  console.log(`  senha:  ${DEV_PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
