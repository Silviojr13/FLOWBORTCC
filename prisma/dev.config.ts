// Configuração do Prisma só para o banco local de desenvolvimento (npm run dev:setup).
// Produção não usa este arquivo: lá a URL do Turso entra pelo adapter em lib/turso-db.ts.
const config = {
  schema: "schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "file:./dev.db" },
};

export default config;
