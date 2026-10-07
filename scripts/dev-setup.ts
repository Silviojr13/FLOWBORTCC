import { spawnSync } from "node:child_process";
import path from "node:path";
import { hash } from "bcrypt";

/**
 * Monta o ambiente de desenvolvimento local: um banco SQLite com todas as tabelas do schema,
 * uma conta de teste e o projeto de exemplo do tour. Nada aqui toca o banco de produção.
 *
 *   cp .env.example .env      (preencha AUTH_SECRET, DEV_PASSWORD e GROQ_API_KEY)
 *   npm run dev:setup
 *   npm run dev
 *
 * Rodar de novo é seguro: as tabelas são sincronizadas e a conta e o projeto não duplicam.
 */

const DEV_EMAIL = "dev@flowbot.local";

async function main() {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  // Trava de segurança: este script só escreve num arquivo local, nunca no Turso.
  if (!url.startsWith("file:")) {
    console.error('O DATABASE_URL do seu .env não é um banco local. Para desenvolver, use DATABASE_URL="file:./dev.db".');
    process.exit(1);
  }
  // A senha da conta de teste é de cada um: vem do .env, nunca do código.
  const devPassword = process.env.DEV_PASSWORD;
  if (!devPassword || devPassword.length < 8) {
    console.error("Defina DEV_PASSWORD no seu .env (ao menos 8 caracteres): é a senha da sua conta de teste.");
    process.exit(1);
  }
  const file = path.resolve(url.slice("file:".length));
  const absoluteUrl = `file:${file}`;
  process.env.DATABASE_URL = absoluteUrl;
  delete process.env.TURSO_AUTH_TOKEN;

  console.log("Criando as tabelas no banco local…");
  // A CLI do Prisma pelo próprio Node, sem depender do PATH.
  const prismaCli = path.resolve("node_modules/prisma/build/index.js");
  const push = spawnSync(process.execPath, [prismaCli, "db", "push", "--config", "prisma/dev.config.ts"], {
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
      password: await hash(devPassword, 10),
      onboardingCompletedAt: now,
      tourCompletedAt: now,
    },
  });
  await createTutorialProject(user.id);
  await db.$disconnect();

  console.log("\nAmbiente pronto. Rode `npm run dev` e entre em http://localhost:3000");
  console.log(`com ${DEV_EMAIL} e a senha que está em DEV_PASSWORD no seu .env.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
