import { PrismaClient } from "@prisma/client";

class DatabaseService {
  private static instance: DatabaseService;
  public client: PrismaClient | null = null;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect(): Promise<PrismaClient> {
    if (this.client) {
      return this.client;
    }

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL não está definido nas variáveis de ambiente");
    }

    try {
      // Tenta usar o adapter
      const { createClient } = await import("@libsql/client");
      const { PrismaLibSql } = await import("@prisma/adapter-libsql");

      const turso = createClient({
        url: databaseUrl,
      });

      const adapter = new PrismaLibSql(turso);

      this.client = new PrismaClient({
        adapter,
        log: ["query", "info", "warn", "error"],
      });
    } catch (adapterError) {
      console.warn("Falha ao inicializar o adapter do Turso:", adapterError);
      console.log("Usando Prisma Client direto (sem adapter) para desenvolvimento...");
      
      // Em caso de falha no adapter, usar o client direto (apenas para desenvolvimento)
      this.client = new PrismaClient({
        log: ["query", "info", "warn", "error"],
      });
    }

    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      this.client = null;
    }
  }
}

export const dbService = DatabaseService.getInstance();

export const getDb = async (): Promise<PrismaClient> => {
  return dbService.connect();
};

export default getDb;