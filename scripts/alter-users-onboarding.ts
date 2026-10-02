import "dotenv/config";
import { createClient } from "@libsql/client";

// Aplica no Turso a migração 20260930180000_user_onboarding.
// Idempotente: o preenchimento de contas antigas só roda quando a coluna
// de conclusão é criada nesta execução.
async function alterUsersOnboarding() {
  console.log("Conectando ao banco Turso...");

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const cols = await client.execute(`PRAGMA table_info(users)`);
    const names = new Set(cols.rows.map((row) => String(row.name)));
    const completingColumnIsNew = !names.has("onboardingCompletedAt");

    if (!names.has("profile")) {
      await client.execute(`ALTER TABLE users ADD COLUMN profile TEXT`);
      console.log("Coluna profile adicionada em users.");
    } else {
      console.log("Coluna profile já existe em users.");
    }

    if (!names.has("discoverySource")) {
      await client.execute(`ALTER TABLE users ADD COLUMN discoverySource TEXT`);
      console.log("Coluna discoverySource adicionada em users.");
    } else {
      console.log("Coluna discoverySource já existe em users.");
    }

    if (completingColumnIsNew) {
      await client.execute(
        `ALTER TABLE users ADD COLUMN onboardingCompletedAt DATETIME`
      );
      await client.execute(
        `UPDATE users SET onboardingCompletedAt = createdAt WHERE onboardingCompletedAt IS NULL`
      );
      console.log(
        "Coluna onboardingCompletedAt adicionada. Contas existentes marcadas como concluídas."
      );
    } else {
      console.log(
        "Coluna onboardingCompletedAt já existe. Contas novas com valor nulo foram preservadas."
      );
    }

    console.log("Migração de onboarding concluída com sucesso!");
  } catch (error) {
    console.error("Erro ao alterar a tabela users:", error);
    process.exitCode = 1;
  }
}

alterUsersOnboarding().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
