import 'dotenv/config';
import { PrismaClient } from '.prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

/**
 * Cria, na conta indicada, um projeto sobre o próprio FlowBot: os requisitos oficiais da
 * documentação (RF01–RF16, RNF01–RNF06), os módulos, as três sprints do TCC e as tarefas
 * já entregues e pendentes. Serve para a equipe acompanhar a evolução da plataforma
 * dentro dela mesma — e para testar como a ferramenta lida com um projeto 100% software.
 *
 *   npm run script:seed-flowbot-project -- usuario@email.com
 *   npm run script:seed-flowbot-project -- usuario@email.com --recriar
 *
 * Sem --recriar, não faz nada se o projeto já existir na conta.
 */

const PROJECT_NAME = 'FlowBot — Plataforma (TCC)';

const db = new PrismaClient({
  adapter: new PrismaLibSql({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
});

function dia(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

type Categoria = 'Funcional' | 'Não Funcional';

// [código, descrição, categoria, prioridade, status, nível]
const REQUISITOS: [string, string, Categoria, string, string, string][] = [
  ['RF01', 'Cadastrar requisitos funcionais e não funcionais com descrição, categoria, prioridade e status (Em Aberto, Validado, Descartado).', 'Funcional', 'Alta', 'Validado', 'Subsistema'],
  ['RF02', 'Garantir rastreabilidade entre requisitos e tarefas do Kanban, indicando quais tarefas implementam cada requisito.', 'Funcional', 'Alta', 'Validado', 'Sistema'],
  ['RF03', 'Permitir edição e versionamento dos requisitos, mantendo histórico de alterações.', 'Funcional', 'Média', 'Validado', 'Subsistema'],
  ['RF04', 'Classificar os requisitos por nível de abstração: sistema, subsistema e componente.', 'Funcional', 'Média', 'Validado', 'Componente'],
  ['RF05', 'Oferecer um quadro Kanban com colunas configuráveis (Backlog, Em Progresso, Em Revisão, Concluído).', 'Funcional', 'Alta', 'Validado', 'Subsistema'],
  ['RF06', 'Criar tarefas com título, descrição, responsável, prazo, prioridade e vínculo a um requisito.', 'Funcional', 'Alta', 'Validado', 'Componente'],
  ['RF07', 'Movimentar tarefas entre colunas por drag-and-drop ou ação manual.', 'Funcional', 'Média', 'Validado', 'Componente'],
  ['RF08', 'Planejar Sprints, associando tarefas a períodos de tempo definidos.', 'Funcional', 'Alta', 'Validado', 'Subsistema'],
  ['RF09', 'Registrar o histórico de movimentação de cada tarefa entre as colunas do Kanban.', 'Funcional', 'Média', 'Validado', 'Componente'],
  ['RF10', 'Cadastrar componentes físicos do projeto com nome, descrição, quantidade e preço unitário estimado.', 'Funcional', 'Alta', 'Validado', 'Subsistema'],
  ['RF11', 'Calcular e exibir automaticamente o custo total estimado do projeto a partir dos componentes.', 'Funcional', 'Média', 'Validado', 'Componente'],
  ['RF12', 'Associar componentes a requisitos ou subsistemas específicos do projeto.', 'Funcional', 'Média', 'Validado', 'Componente'],
  ['RF13', 'Gerar relatórios automáticos de progresso com o percentual de tarefas concluídas por Sprint e por módulo.', 'Funcional', 'Alta', 'Validado', 'Subsistema'],
  ['RF14', 'Exibir dashboard com indicadores de saúde: tarefas em atraso, requisitos sem cobertura e custo acumulado.', 'Funcional', 'Alta', 'Validado', 'Sistema'],
  ['RF15', 'Exportar relatórios nos formatos PDF ou CSV.', 'Funcional', 'Média', 'Validado', 'Componente'],
  ['RF16', 'Cadastrar projetos com nome, descrição, data de início e data prevista de término.', 'Funcional', 'Alta', 'Validado', 'Sistema'],
  ['RNF01', 'Atingir pontuação média igual ou superior a 70 no questionário SUS na avaliação com usuários reais.', 'Não Funcional', 'Alta', 'Em Aberto', 'Sistema'],
  ['RNF02', 'Interface responsiva e funcional nas versões recentes do Chrome, Firefox e Edge.', 'Não Funcional', 'Média', 'Em Aberto', 'Sistema'],
  ['RNF03', 'Nenhuma alteração de requisito, tarefa ou componente pode ser perdida em falha inesperada: persistência imediata a cada escrita.', 'Não Funcional', 'Alta', 'Validado', 'Sistema'],
  ['RNF04', 'Manter histórico de versionamento dos requisitos, garantindo rastreabilidade ao longo do ciclo de vida.', 'Não Funcional', 'Média', 'Validado', 'Subsistema'],
  ['RNF05', 'Acesso protegido por autenticação: cada usuário vê e edita apenas os projetos aos quais tem permissão.', 'Não Funcional', 'Alta', 'Validado', 'Sistema'],
  ['RNF06', 'Acessível em Windows, macOS ou Linux sem instalar nada além de um navegador atualizado.', 'Não Funcional', 'Baixa', 'Validado', 'Sistema'],
];

// [nome, descrição, status, requisito principal]
const MODULOS: [string, string, string, string][] = [
  ['Gestão de Requisitos', 'Cadastro, edição com histórico, níveis de abstração e cobertura por tarefas.', 'Concluída', 'RF01'],
  ['Kanban e Sprints', 'Quadro configurável, tarefas, drag-and-drop, sprints e histórico de movimentação.', 'Concluída', 'RF05'],
  ['Componentes', 'Componentes do projeto, custo total e vínculo com requisitos.', 'Concluída', 'RF10'],
  ['Relatórios e Indicadores', 'Visão geral com indicadores de saúde e relatório com exportação em PDF, CSV e Markdown.', 'Concluída', 'RF13'],
  ['Assistente FlowBot (IA)', 'Criação de projeto por conversa e robô do projeto que propõe alterações e só grava após confirmação.', 'Em desenvolvimento', 'RF01'],
  ['Autenticação e Onboarding', 'Login com e-mail e Google, pesquisa de primeiro acesso e isolamento por usuário.', 'Concluída', 'RNF05'],
  ['Tour guiado', 'Tutorial gamificado da primeira sessão com projeto de exemplo (guia do usuário dentro da plataforma).', 'Concluída', 'RF16'],
  ['Qualidade e testes', 'Testes E2E com Selenium, análise estática com SonarCloud e homologação.', 'Em desenvolvimento', 'RNF02'],
  ['Validação com usuários', 'Avaliação SUS com 8 a 12 participantes e análise dos resultados.', 'Planejada', 'RNF01'],
  ['Visão hardware × software', 'Separar a visão de hardware e de software do projeto, com ciclo de vida dos componentes.', 'Planejada', 'RF12'],
];

// Serviços que sustentam a plataforma. O módulo foi pensado para peças físicas; aqui ele
// é usado para os custos de infraestrutura de um projeto só de software.
// [nome, descrição, quantidade, preço unitário, requisito]
const COMPONENTES: [string, string, number, number, string | null][] = [
  ['Vercel (plano Hobby)', 'Hospedagem e deploy contínuo do Next.js — flowbottcc.vercel.app', 1, 0, 'RNF06'],
  ['Turso (plano gratuito)', 'Banco SQLite distribuído (libSQL) com Prisma', 1, 0, 'RNF03'],
  ['Groq API (camada gratuita)', 'Modelo de linguagem do assistente FlowBot', 1, 0, null],
  ['Google OAuth', 'Login com conta Google via NextAuth', 1, 0, 'RNF05'],
  ['GitHub + SonarCloud', 'Repositório, CI (lint, tipos e build) e análise estática', 1, 0, 'RNF02'],
];

// Quem e o que a equipe usa para construir a plataforma (aba Recursos).
// [tipo, nome, descrição, disponibilidade, cobrança, custo unitário, quantidade, requisito]
const RECURSOS: [string, string, string, string, string, number, number, string | null][] = [
  ['pessoa', 'Desenvolvedor full stack', 'Next.js, Prisma e integração com a IA', 'disponivel', 'hora', 45, 240, null],
  ['pessoa', 'Desenvolvedor front-end e UX', 'Telas, tour guiado e acessibilidade', 'disponivel', 'hora', 40, 200, 'RNF01'],
  ['pessoa', 'Analista de requisitos e testes', 'Documentação, Selenium e validação SUS', 'disponivel', 'hora', 38, 160, 'RNF02'],
  ['pessoa', 'Orientação acadêmica', 'Reuniões semanais com o orientador', 'disponivel', 'hora', 0, 24, null],
  ['equipamento', 'Notebooks da equipe', '3 notebooks pessoais já disponíveis', 'disponivel', 'unico', 150, 3, null],
  ['software', 'Groq API — plano pago', 'Necessário se a validação passar do limite gratuito', 'adquirir', 'mes', 55, 2, null],
  ['software', 'Domínio próprio (.com.br)', 'Opcional para a banca', 'adquirir', 'unico', 40, 1, null],
  ['espaco', 'Laboratório da PUCPR', 'Sessões presenciais da validação', 'disponivel', 'mes', 0, 1, null],
];

const SPRINTS = [
  { nome: 'Sprint 1 — Fundação e Kanban', objetivo: 'Requisitos, Kanban, componentes e relatórios funcionando de ponta a ponta.', inicio: '2026-08-13', fim: '2026-09-14' },
  { nome: 'Sprint 2 — Integração e qualidade', objetivo: 'Integrar os módulos, testes E2E, SonarCloud, homologação e guia do usuário.', inicio: '2026-09-15', fim: '2026-10-23' },
  { nome: 'Sprint 3 — Validação', objetivo: 'Avaliação SUS com usuários reais e ajustes finais da entrega.', inicio: '2026-10-24', fim: '2026-11-07' },
];

type Coluna = 'Backlog' | 'Em Progresso' | 'Em Revisão' | 'Concluído';

interface Tarefa {
  titulo: string;
  descricao?: string;
  prioridade: 'Alta' | 'Média' | 'Baixa';
  responsavel?: string;
  prazo?: string;
  requisito?: string;
  modulo?: string;
  sprint?: 0 | 1 | 2;
  coluna: Coluna;
  /** Data em que a tarefa chegou à coluna atual (histórico). */
  em?: string;
}

const TAREFAS: Tarefa[] = [
  // Sprint 1
  { titulo: 'Cadastro de projetos com datas de início e término', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-08-22', requisito: 'RF16', modulo: 'Gestão de Requisitos', sprint: 0, coluna: 'Concluído', em: '2026-08-21' },
  { titulo: 'CRUD de requisitos com código automático (RF/RNF)', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-08-26', requisito: 'RF01', modulo: 'Gestão de Requisitos', sprint: 0, coluna: 'Concluído', em: '2026-08-25' },
  { titulo: 'Histórico de versões dos requisitos', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-08-29', requisito: 'RF03', modulo: 'Gestão de Requisitos', sprint: 0, coluna: 'Concluído', em: '2026-08-28' },
  { titulo: 'Classificação por nível (Sistema, Subsistema, Componente)', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-08-29', requisito: 'RF04', modulo: 'Gestão de Requisitos', sprint: 0, coluna: 'Concluído', em: '2026-08-29' },
  { titulo: 'Quadro Kanban com colunas configuráveis e limite WIP', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-05', requisito: 'RF05', modulo: 'Kanban e Sprints', sprint: 0, coluna: 'Concluído', em: '2026-09-04' },
  { titulo: 'Tarefas com responsável, prazo, prioridade e requisito', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-05', requisito: 'RF06', modulo: 'Kanban e Sprints', sprint: 0, coluna: 'Concluído', em: '2026-09-05' },
  { titulo: 'Drag-and-drop entre colunas (dnd-kit) e movimentação manual', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-09-08', requisito: 'RF07', modulo: 'Kanban e Sprints', sprint: 0, coluna: 'Concluído', em: '2026-09-07' },
  { titulo: 'Planejamento de sprints com período e objetivo', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-10', requisito: 'RF08', modulo: 'Kanban e Sprints', sprint: 0, coluna: 'Concluído', em: '2026-09-09' },
  { titulo: 'Histórico de movimentação das tarefas', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-09-10', requisito: 'RF09', modulo: 'Kanban e Sprints', sprint: 0, coluna: 'Concluído', em: '2026-09-10' },
  { titulo: 'Exibir o histórico de versões no requisito', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-08-30', requisito: 'RNF04', modulo: 'Gestão de Requisitos', sprint: 0, coluna: 'Concluído', em: '2026-08-30' },
  { titulo: 'Cadastro de componentes com quantidade e preço unitário', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-11', requisito: 'RF10', modulo: 'Componentes', sprint: 0, coluna: 'Concluído', em: '2026-09-11' },
  { titulo: 'Cálculo automático do custo total do projeto', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-09-12', requisito: 'RF11', modulo: 'Componentes', sprint: 0, coluna: 'Concluído', em: '2026-09-12' },
  { titulo: 'Deploy contínuo na Vercel (flowbottcc.vercel.app)', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-14', requisito: 'RNF06', modulo: 'Qualidade e testes', sprint: 0, coluna: 'Concluído', em: '2026-09-14' },
  { titulo: 'Login com e-mail e Google (NextAuth) e isolamento por usuário', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-12', requisito: 'RNF05', modulo: 'Autenticação e Onboarding', sprint: 0, coluna: 'Concluído', em: '2026-09-12' },
  { titulo: 'Criação de projeto por conversa com a IA', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-14', requisito: 'RF01', modulo: 'Assistente FlowBot (IA)', sprint: 0, coluna: 'Concluído', em: '2026-09-13' },
  // Sprint 2
  { titulo: 'Integração entre módulos (eventos de projeto)', descricao: 'Requisito descartado reflete nas tarefas; tarefa concluída valida o requisito; custos por requisito.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-22', requisito: 'RF02', modulo: 'Relatórios e Indicadores', sprint: 1, coluna: 'Concluído', em: '2026-09-21' },
  { titulo: 'Indicadores de saúde na visão geral', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-22', requisito: 'RF14', modulo: 'Relatórios e Indicadores', sprint: 1, coluna: 'Concluído', em: '2026-09-22' },
  { titulo: 'Relatório por sprint e por módulo', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-24', requisito: 'RF13', modulo: 'Relatórios e Indicadores', sprint: 1, coluna: 'Concluído', em: '2026-09-23' },
  { titulo: 'Exportação do relatório em PDF, CSV e Markdown', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-09-24', requisito: 'RF15', modulo: 'Relatórios e Indicadores', sprint: 1, coluna: 'Concluído', em: '2026-09-24' },
  { titulo: 'Associação de componentes a requisitos', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-09-24', requisito: 'RF12', modulo: 'Componentes', sprint: 1, coluna: 'Concluído', em: '2026-09-24' },
  { titulo: 'Robô assistente do projeto com confirmação antes de gravar', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-26', requisito: 'RNF03', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Concluído', em: '2026-09-26' },
  { titulo: 'Pesquisa de onboarding no primeiro acesso', prioridade: 'Média', responsavel: 'Lucas', prazo: '2026-09-28', requisito: 'RNF01', modulo: 'Autenticação e Onboarding', sprint: 1, coluna: 'Concluído', em: '2026-09-28' },
  { titulo: 'Ajustes de UI/UX (versão 2)', prioridade: 'Média', responsavel: 'Lucas', prazo: '2026-09-29', requisito: 'RNF02', modulo: 'Autenticação e Onboarding', sprint: 1, coluna: 'Concluído', em: '2026-09-29' },
  { titulo: 'Corrigir redirecionamento do login Google para o domínio da Vercel', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-27', requisito: 'RNF05', modulo: 'Autenticação e Onboarding', sprint: 1, coluna: 'Concluído', em: '2026-09-27' },
  { titulo: 'Suíte de testes E2E com Selenium (pytest)', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-09-25', requisito: 'RNF02', modulo: 'Qualidade e testes', sprint: 1, coluna: 'Concluído', em: '2026-09-25' },
  { titulo: 'Tour guiado gamificado (guia do usuário)', descricao: 'Convite após o onboarding, demonstração da IA criando o braço robótico e passeio pelos módulos.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-01', requisito: 'RF16', modulo: 'Tour guiado', sprint: 1, coluna: 'Concluído', em: '2026-10-01' },
  { titulo: 'Criar projeto no SonarCloud e configurar SONAR_TOKEN', descricao: 'A configuração já está no repositório; falta criar o projeto e o secret no GitHub.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RNF02', modulo: 'Qualidade e testes', sprint: 1, coluna: 'Em Progresso', em: '2026-09-30' },
  { titulo: 'Melhorias do chat: contexto enxuto, limite de histórico e aviso de truncamento', prioridade: 'Média', prazo: '2026-10-14', requisito: 'RNF03', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Botão "Excluir projeto" com confirmação do impacto', prioridade: 'Média', prazo: '2026-10-14', requisito: 'RF16', modulo: 'Gestão de Requisitos', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Testar a interface no Chrome e no Firefox', descricao: 'A suíte E2E roda hoje só no Edge.', prioridade: 'Média', prazo: '2026-10-16', requisito: 'RNF02', modulo: 'Qualidade e testes', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Homologação da Sprint 2 com o orientador', prioridade: 'Alta', prazo: '2026-10-23', requisito: 'RNF01', modulo: 'Qualidade e testes', sprint: 1, coluna: 'Em Revisão', em: '2026-10-01' },
  // Sprint 3
  { titulo: 'Preparar roteiro de tarefas e questionário SUS', prioridade: 'Alta', prazo: '2026-10-27', requisito: 'RNF01', modulo: 'Validação com usuários', sprint: 2, coluna: 'Backlog' },
  { titulo: 'Recrutar de 8 a 12 participantes', prioridade: 'Alta', prazo: '2026-10-28', requisito: 'RNF01', modulo: 'Validação com usuários', sprint: 2, coluna: 'Backlog' },
  { titulo: 'Aplicar as sessões de avaliação', prioridade: 'Alta', prazo: '2026-11-03', requisito: 'RNF01', modulo: 'Validação com usuários', sprint: 2, coluna: 'Backlog' },
  { titulo: 'Analisar os resultados do SUS e registrar no TCC', prioridade: 'Alta', prazo: '2026-11-06', requisito: 'RNF01', modulo: 'Validação com usuários', sprint: 2, coluna: 'Backlog' },
  { titulo: 'Separar a visão de hardware e de software do projeto', descricao: 'Campo de domínio (HW/SW) e ciclo de vida do componente: Sugerido, Aprovado, Comprado.', prioridade: 'Média', prazo: '2026-11-05', requisito: 'RF12', modulo: 'Visão hardware × software', sprint: 2, coluna: 'Backlog' },
  // Sem sprint (trabalhos futuros)
  { titulo: 'Times e hierarquias de acesso por projeto', descricao: 'Previsto como trabalho futuro do TCC.', prioridade: 'Baixa', requisito: 'RNF05', coluna: 'Backlog' },
];

async function main() {
  const email = process.argv.find((arg) => arg.includes('@'));
  const recriar = process.argv.includes('--recriar');
  if (!email) {
    console.error('Informe o e-mail da conta: npm run script:seed-flowbot-project -- usuario@email.com');
    process.exitCode = 1;
    return;
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) {
    console.error(`Nenhuma conta encontrada com o e-mail ${email}.`);
    process.exitCode = 1;
    return;
  }

  const existente = await db.project.findFirst({ where: { userId: user.id, name: PROJECT_NAME }, select: { id: true } });
  if (existente && !recriar) {
    console.log(`O projeto já existe (${existente.id}). Use --recriar para apagá-lo e criar de novo.`);
    return;
  }
  if (existente) {
    // As tarefas bloqueiam a exclusão das colunas (onDelete: Restrict): saem primeiro.
    await db.task.deleteMany({ where: { projectId: existente.id } });
    await db.project.delete({ where: { id: existente.id } });
  }

  const project = await db.project.create({
    data: {
      name: PROJECT_NAME,
      description:
        'A própria plataforma FlowBot gerenciada dentro do FlowBot: gestão de projetos de robótica e sistemas embarcados com requisitos, Kanban, componentes, relatórios e assistente com IA. TCC de Engenharia de Software da PUCPR (grupo 13: Lucas Bertoli, Murilo Pereira e Silvio Cezar; orientador Prof. Afonso Miguel).',
      origin: 'manual',
      userId: user.id,
      startDate: dia('2026-08-13'),
      endDate: dia('2026-11-07'),
    },
  });
  const projectId = project.id;

  const requisitoId = new Map<string, string>();
  for (const [code, description, category, priority, status, level] of REQUISITOS) {
    const r = await db.requirement.create({
      data: { code, description, category, priority, status, level, projectId },
      select: { id: true },
    });
    requisitoId.set(code, r.id);
  }

  const moduloId = new Map<string, string>();
  for (const [name, description, status, req] of MODULOS) {
    const f = await db.feature.create({
      data: { name, description, status, projectId, requirementId: requisitoId.get(req) },
      select: { id: true },
    });
    moduloId.set(name, f.id);
  }

  await db.hardwareComponent.createMany({
    data: COMPONENTES.map(([name, description, quantity, unitPrice, req]) => ({
      name,
      description,
      quantity,
      unitPrice,
      domain: 'Software',
      projectId,
      requirementId: req ? requisitoId.get(req) : null,
    })),
  });

  await db.resource.createMany({
    data: RECURSOS.map(([type, name, description, availability, costModel, unitCost, quantity, req]) => ({
      type,
      name,
      description,
      availability,
      costModel,
      unitCost,
      quantity,
      projectId,
      requirementId: req ? requisitoId.get(req) : null,
    })),
  });

  const nomesColunas: Coluna[] = ['Backlog', 'Em Progresso', 'Em Revisão', 'Concluído'];
  const colunaId = new Map<Coluna, string>();
  for (const [order, name] of nomesColunas.entries()) {
    const c = await db.kanbanColumn.create({
      data: { name, order, isDone: name === 'Concluído', projectId },
      select: { id: true },
    });
    colunaId.set(name, c.id);
  }

  const sprintIds: string[] = [];
  for (const s of SPRINTS) {
    const created = await db.sprint.create({
      data: { name: s.nome, goal: s.objetivo, startDate: dia(s.inicio), endDate: dia(s.fim), projectId },
      select: { id: true },
    });
    sprintIds.push(created.id);
  }

  const ordem = new Map<Coluna, number>();
  for (const t of TAREFAS) {
    const order = ordem.get(t.coluna) ?? 0;
    ordem.set(t.coluna, order + 1);

    // Histórico coerente com a coluna: Backlog → Em Progresso → (Em Revisão) → Concluído.
    const caminho = nomesColunas.slice(0, nomesColunas.indexOf(t.coluna) + 1);
    const chegada = t.em ? dia(t.em) : new Date();
    const history = caminho.map((toColumn, i) => ({
      fromColumn: i === 0 ? null : caminho[i - 1],
      toColumn,
      changedAt: new Date(chegada.getTime() - (caminho.length - 1 - i) * 24 * 60 * 60 * 1000),
    }));

    await db.task.create({
      data: {
        title: t.titulo,
        description: t.descricao,
        priority: t.prioridade,
        assignee: t.responsavel ?? null,
        dueDate: t.prazo ? dia(t.prazo) : null,
        order,
        columnId: colunaId.get(t.coluna)!,
        projectId,
        requirementId: t.requisito ? requisitoId.get(t.requisito) : null,
        featureId: t.modulo ? moduloId.get(t.modulo) : null,
        sprintId: t.sprint === undefined ? null : sprintIds[t.sprint],
        history: { create: history },
      },
    });
  }

  console.log(`Projeto "${PROJECT_NAME}" criado para ${user.name ?? email}.`);
  console.log(`  ${REQUISITOS.length} requisitos, ${MODULOS.length} módulos, ${COMPONENTES.length} componentes, ${RECURSOS.length} recursos, ${SPRINTS.length} sprints, ${TAREFAS.length} tarefas`);
  console.log(`  /dashboard/projects/${projectId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
