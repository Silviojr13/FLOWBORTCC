// Carregar dotenv imediatamente
import 'dotenv/config';

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('TURSO_AUTH_TOKEN exists:', !!process.env.TURSO_AUTH_TOKEN);
  
  // Importar os módulos após carregar o dotenv
  const { createClient } = await import("@libsql/client");

  // Tentar criar cliente do LibSQL com as credenciais do ambiente
  try {
    const turso = createClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    console.log("Cliente LibSQL criado com sucesso!");
    
    // Testar a conexão
    const result = await turso.execute("SELECT 1 as test");
    console.log("Resultado da consulta:", result.rows);
    
    console.log("✅ Conexão direta com Turso bem-sucedida!");
  } catch (error) {
    console.error("❌ Erro ao conectar com LibSQL diretamente:", error);
  }
}

main()
  .catch(console.error);