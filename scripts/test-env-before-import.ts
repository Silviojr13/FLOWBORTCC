// Verificar as variáveis antes de qualquer importação
console.log('Antes da importação:');
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('TURSO_AUTH_TOKEN exists:', !!process.env.TURSO_AUTH_TOKEN);

// Importar dotenv explicitamente
import('dotenv').then(dotenv => {
  dotenv.config();
  console.log('\nApós carregar dotenv:');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('TURSO_AUTH_TOKEN exists:', !!process.env.TURSO_AUTH_TOKEN);

  // Agora importar o db
  import('../lib/db').then(({ db }) => {
    console.log('\nCliente Prisma criado.');
    
    // Testar a conexão
    db.$connect()
      .then(() => {
        console.log('✅ Conexão bem-sucedida!');
        
        return db.$queryRaw`SELECT 1 as test`;
      })
      .then(result => {
        console.log('Resultado da consulta:', result);
      })
      .catch(error => {
        console.error('❌ Erro:', error);
      })
      .finally(() => {
        db.$disconnect();
      });
  }).catch(err => {
    console.error('Erro ao importar db:', err);
  });
}).catch(err => {
  console.error('Erro ao carregar dotenv:', err);
});