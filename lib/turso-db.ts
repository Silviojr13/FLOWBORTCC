import { PrismaClient } from ".prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// A partir do Prisma 6.6.0, o adapter recebe a config direto (url + authToken),
// sem criar o cliente @libsql/client manualmente.
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

declare global {
  // eslint-disable-next-line no-var
  var prismaTurso: PrismaClient | undefined;
}

const db =
  global.prismaTurso ??
  new PrismaClient({
    adapter,
    log: ["query", "info", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaTurso = db;
}

export { db as tursoDb };
export default db;