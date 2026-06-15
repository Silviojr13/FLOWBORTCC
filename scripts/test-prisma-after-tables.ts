import 'dotenv/config';
import { db } from '../lib/db';

async function testPrismaConnection() {
  console.log('Tentando conectar com Prisma...');

  try {
    // Testar a conexão
    await db.$connect();
    console.log('✅ Conexão com o banco de dados bem-sucedida!');

    // Testar consultando se há usuários (mesmo que não existam)
    const userCount = await db.user.count();
    console.log(`Número de usuários no banco: ${userCount}`);

    // Testar criando um usuário de teste
    const newUser = await db.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
    console.log('Usuário de teste criado:', newUser.id);

    // Buscar o usuário criado
    const foundUser = await db.user.findUnique({
      where: { id: newUser.id }
    });
    console.log('Usuário encontrado:', foundUser?.name);

    // Limpar: deletar o usuário de teste
    await db.user.delete({
      where: { id: newUser.id }
    });
    console.log('Usuário de teste deletado.');

  } catch (error) {
    console.error('❌ Erro ao conectar ao banco de dados:', error);
  } finally {
    await db.$disconnect();
    console.log('Conexão desconectada.');
  }
}

testPrismaConnection();