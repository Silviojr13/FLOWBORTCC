import 'dotenv/config';
import { createClient } from '@libsql/client';

/**
 * Reexecuta o tour guiado para uma conta, útil em testes e demonstrações.
 *
 *   npm run script:reset-tour -- usuario@email.com
 *   npm run script:reset-tour -- usuario@email.com --apagar-projeto
 *
 * Sem --apagar-projeto, o projeto de exemplo existente é reaproveitado.
 */
async function resetTour() {
  const email = process.argv.find((arg) => arg.includes('@'));
  const apagarProjeto = process.argv.includes('--apagar-projeto');

  if (!email) {
    console.error('Informe o e-mail da conta: npm run script:reset-tour -- usuario@email.com');
    process.exitCode = 1;
    return;
  }

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const usuario = await client.execute({
      sql: 'SELECT id, name FROM users WHERE email = ?',
      args: [email],
    });

    if (usuario.rows.length === 0) {
      console.error(`Nenhuma conta encontrada com o e-mail ${email}.`);
      process.exitCode = 1;
      return;
    }

    const userId = String(usuario.rows[0].id);

    await client.execute({
      sql: 'UPDATE users SET tourCompletedAt = NULL WHERE id = ?',
      args: [userId],
    });
    console.log(`Tour reaberto para ${email}.`);

    if (apagarProjeto) {
      const projetos = await client.execute({
        sql: 'SELECT id FROM projects WHERE userId = ? AND isTutorial = 1',
        args: [userId],
      });

      for (const row of projetos.rows) {
        // As demais tabelas apagam em cascata, exceto tasks (coluna com ON DELETE RESTRICT).
        await client.execute({ sql: 'DELETE FROM tasks WHERE projectId = ?', args: [row.id] });
        await client.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [row.id] });
        console.log(`Projeto de exemplo ${row.id} removido.`);
      }

      if (projetos.rows.length === 0) {
        console.log('Nenhum projeto de exemplo para remover.');
      }
    }

    console.log('Pronto: o tour será oferecido no próximo acesso ao painel.');
  } catch (error) {
    console.error('Erro ao reabrir o tour:', error);
    process.exitCode = 1;
  }
}

resetTour().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
