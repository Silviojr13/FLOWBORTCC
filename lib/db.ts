import { PrismaClient } from ".prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient;
}

let db: PrismaClient;

if (process.env.NODE_ENV === "production") {
  // Em produção, criar nova instância
  db = new PrismaClient({
    log: ["query", "info", "warn", "error"],
  });
} else {
  // Em desenvolvimento, usar cache global
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }
  db = global.prisma;
}

export { db };
export default db;