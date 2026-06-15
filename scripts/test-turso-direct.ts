import { createClient } from "@libsql/client";

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  console.log("TURSO_AUTH_TOKEN:", process.env.TURSO_AUTH_TOKEN ? "Presente" : "Ausente");
  
  try {
    const turso = createClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    
    console.log("Cliente LibSQL criado com sucesso!");
    
    const result = await turso.execute("SELECT 1 as test");
    console.log("Resultado da consulta:", result.rows);
  } catch (error) {
    console.error("Erro ao conectar com LibSQL:", error);
  }
}

main();