import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Em desenvolvimento, usar cache global para evitar recarregar o cliente
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient;
}

export async function createPrismaClient(): Promise<PrismaClient> {
  // Certificar-se de que as variáveis de ambiente estão disponíveis
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não está definido nas variáveis de ambiente");
  }

  if (!process.env.TURSO_AUTH_TOKEN) {
    throw new Error("TURSO_AUTH_TOKEN não está definido nas variáveis de ambiente");
  }

  // Criar cliente do LibSQL com as credenciais do ambiente
  const turso = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Criar adapter do Prisma para LibSQL
  const adapter = new PrismaLibSql(turso);

  // Retornar nova instância do PrismaClient com o adapter
  const client = new PrismaClient({
    adapter,
    log: ["query", "info", "warn", "error"],
  });

  return client;
}

export async function getDb(): Promise<PrismaClient> {
  if (process.env.NODE_ENV === "production") {
    // Em produção, criar nova instância com o adapter
    return await createPrismaClient();
  } else {
    // Em desenvolvimento, usar cache global
    if (!global.prisma) {
      global.prisma = await createPrismaClient();
    }
    return global.prisma;
  }
}