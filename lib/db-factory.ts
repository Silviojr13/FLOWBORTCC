import { PrismaClient } from "@prisma/client";

// Função factory para criar o PrismaClient com o adapter correto
export async function createPrismaClient() {
  // Obter o DATABASE_URL do ambiente
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL não está definido nas variáveis de ambiente");
  }

  // Importar dinamicamente os módulos necessários
  const { createClient } = await import("@libsql/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");

  // Criar cliente do LibSQL
  const turso = createClient({
    url: databaseUrl,
  });

  // Criar adapter do Prisma para LibSQL
  const adapter = new PrismaLibSql(turso);

  // Retornar nova instância do PrismaClient com o adapter
  return new PrismaClient({
    adapter,
    log: ["query", "info", "warn", "error"],
  });
}

// Exportar também uma instância padrão para compatibilidade
let db: PrismaClient | null = null;

export const getDb = async (): Promise<PrismaClient> => {
  if (!db) {
    db = await createPrismaClient();
  }
  return db;
};