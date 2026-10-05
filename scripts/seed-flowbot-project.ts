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
 *   npm run script:seed-flowbot-project -- usuario@email.com --atualizar
 *   npm run script:seed-flowbot-project -- usuario@email.com --recriar
 *
 * --atualizar sincroniza um projeto existente sem apagar nada: cria os requisitos, módulos e
 * tarefas que faltam, avança tarefas que ficaram prontas (nunca as move para trás) e
 * redesenha os diagramas gerados a partir dos dados. O que a equipe criou ou mudou à mão
 * continua como está. --recriar apaga o projeto e cria de novo.
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
  ['RF17', 'Gerar diagramas de engenharia de software (C4, modelo relacional e UML) a partir dos dados do projeto.', 'Funcional', 'Média', 'Validado', 'Subsistema'],
  ['RF18', 'Cadastrar os recursos do projeto (pessoas, equipamentos, software e espaços) com custo e disponibilidade, compondo o orçamento consolidado.', 'Funcional', 'Média', 'Validado', 'Subsistema'],
  ['RF19', 'Compartilhar o projeto por convite (e-mail exato ou link); quem aceita entra como visitante, só com leitura.', 'Funcional', 'Alta', 'Validado', 'Sistema'],
  ['RF20', 'Controlar o acesso ao projeto por cargo (dono, gestor, funcionário, estagiário e visitante), com as permissões verificadas no servidor.', 'Funcional', 'Alta', 'Validado', 'Sistema'],
  ['RF21', 'Ocultar custos, preços, orçamento e recursos de quem não pode vê-los, com liberação pelo dono do projeto.', 'Funcional', 'Média', 'Validado', 'Subsistema'],
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
  ['Componentes', 'Componentes de hardware e software do produto, custo total e vínculo com requisitos.', 'Concluída', 'RF10'],
  ['Relatórios e Indicadores', 'Visão geral com indicadores de saúde e relatório com exportação em PDF, CSV e Markdown.', 'Concluída', 'RF13'],
  ['Assistente FlowBot (IA)', 'Criação de projeto por conversa e robô do projeto que propõe alterações e só grava após confirmação.', 'Em desenvolvimento', 'RF01'],
  ['Autenticação e Onboarding', 'Login com e-mail e Google, pesquisa de primeiro acesso e isolamento por usuário.', 'Concluída', 'RNF05'],
  ['Tour guiado', 'Tutorial gamificado da primeira sessão com projeto de exemplo (guia do usuário dentro da plataforma).', 'Concluída', 'RF16'],
  ['Qualidade e testes', 'Testes E2E com Selenium, análise estática com SonarCloud e homologação.', 'Em desenvolvimento', 'RNF02'],
  ['Validação com usuários', 'Avaliação SUS com 8 a 12 participantes e análise dos resultados.', 'Em desenvolvimento', 'RNF01'],
  ['Visão hardware × software', 'Separar a visão de hardware e de software do projeto, com ciclo de vida dos componentes.', 'Em desenvolvimento', 'RF12'],
  ['Diagramas de engenharia', 'C4, modelo relacional e UML escritos pela IA; rastreabilidade e cronograma a partir dos dados.', 'Concluída', 'RF17'],
  ['Recursos e orçamento', 'Pessoas, equipamentos, software e espaços com custo e disponibilidade; orçamento consolidado.', 'Concluída', 'RF18'],
  ['Avaliação na plataforma', 'Convite por link e por e-mail, guia do participante, tarefas detectadas e questionário SUS com resultados no admin.', 'Concluída', 'RNF01'],
  ['Central de tutoriais', 'Tutorial de cada tela, tour para iniciantes e tutorial completo do projeto.', 'Concluída', 'RNF01'],
  ['Compartilhamento e cargos', 'Convite por e-mail ou link, cargos (gestor, funcionário, estagiário, visitante) e custos ocultos; falta o painel de permissões por área.', 'Em desenvolvimento', 'RF19'],
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
  { titulo: 'Criar projeto no SonarCloud e configurar SONAR_TOKEN', descricao: 'Projeto ligado com análise automática (sem token): nota A, 0 bugs, 0 vulnerabilidades e Quality Gate aprovado.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RNF02', modulo: 'Qualidade e testes', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Melhorias do chat: contexto enxuto, limite de histórico e aviso de truncamento', descricao: 'Conversa cortada para caber no limite de tokens por minuto do Groq (primeira mensagem + recentes, com aviso à IA); contexto do projeto resumido; mensagens de erro claras.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF03', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Anexar arquivos de texto no chat', descricao: 'Clipe anexa .txt, .md, .csv, .json e código; a conversa mostra o arquivo como cartão.', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF01', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Ditar mensagem por voz no chat', descricao: 'No Chrome e no Edge, reconhecimento de voz do navegador; nos demais, gravação e transcrição pelo Whisper do Groq.', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF01', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Remover a trilha lateral de etapas da criação de projeto', descricao: 'A trilha (Requisitos, Funcionalidades, Componentes, Custos, Finalizar) ocupava espaço e não ajudava mais; os botões Voltar/Continuar continuam.', prioridade: 'Baixa', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF01', modulo: 'Autenticação e Onboarding', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Chat espera sozinho o limite por minuto da IA', descricao: 'Em vez de erro, mostra a contagem e reenvia na mesma conversa, sem duplicar a mensagem; cada envio usa até ~3400 tokens.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF03', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Conversa com a IA reaberta ao recarregar a página', descricao: 'A conversa em andamento (antes de virar projeto) volta depois de recarregar; botão Nova conversa para começar do zero.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF03', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Assistente monta o projeto em pacotes prontos e didáticos', descricao: 'Propõe requisitos, funcionalidades, sprints e tarefas sem perguntar antes, explicando o porquê; card agrupado por seção; itens do mesmo pacote se ligam entre si.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RF16', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Concluído', em: '2026-10-05' },
  { titulo: 'Corrigir respostas da IA com trechos perdidos e cortadas', descricao: 'Linhas do streaming partidas entre pedaços eram descartadas; resposta acima do limite de saída do Groq (1000 tokens/min) agora vem em partes e aproveita as ações completas.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF03', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Concluído', em: '2026-10-05' },
  { titulo: 'Ditado por voz no assistente do projeto', descricao: 'Levar o microfone do chat principal para o assistente flutuante.', prioridade: 'Baixa', prazo: '2026-10-23', requisito: 'RNF01', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Liberar o modelo de transcrição (Whisper) no projeto do Groq', descricao: 'Em console.groq.com > Settings > Project > Limits, liberar whisper-large-v3-turbo para a gravação funcionar fora do Chrome e do Edge.', prioridade: 'Baixa', prazo: '2026-10-23', requisito: 'RNF01', modulo: 'Assistente FlowBot (IA)', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Botão "Excluir projeto" com confirmação do impacto', descricao: 'No menu do card e em Editar projeto; mostra o que será apagado e pede o nome do projeto.', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RF16', modulo: 'Gestão de Requisitos', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Testar a interface no Chrome e no Firefox', descricao: 'A suíte E2E roda hoje só no Edge.', prioridade: 'Média', prazo: '2026-10-16', requisito: 'RNF02', modulo: 'Qualidade e testes', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Corrigir os apontamentos do SonarCloud (0 bugs e 0 vulnerabilidades)', descricao: 'Logs sem dados sensíveis, promessas tratadas, ordenação e acessibilidade do Kanban.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RNF03', modulo: 'Qualidade e testes', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Endurecer o CI (instalação sem scripts e análise automática)', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RNF05', modulo: 'Qualidade e testes', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Diagramas C4, ER e UML gerados pela IA', descricao: 'Níveis do C4 consistentes, correção automática de sintaxe, exportação em SVG e PNG.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RF17', modulo: 'Diagramas de engenharia', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Rastreabilidade e cronograma (Gantt) a partir dos dados', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RF17', modulo: 'Diagramas de engenharia', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Aba Recursos com orçamento consolidado', descricao: 'Disponível ou a adquirir; cobrança por hora, por mês ou valor único.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RF18', modulo: 'Recursos e orçamento', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Componentes classificados como hardware ou software', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RF12', modulo: 'Componentes', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Filtros do relatório por sprint, responsável e funcionalidade', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RF13', modulo: 'Relatórios e Indicadores', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Relatório em PDF no formato de documento (A4)', descricao: 'Cabeçalho, rodapé com número de página e tabelas que repetem o cabeçalho.', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RF15', modulo: 'Relatórios e Indicadores', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Guia do participante e questionário SUS dentro da plataforma', descricao: 'Painel lateral com termo, tarefas detectadas automaticamente e questionário.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF01', modulo: 'Avaliação na plataforma', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Painel de resultados da avaliação para o admin', descricao: 'Nota SUS, conclusão e tempo por tarefa, perfil, respostas abertas anônimas e CSV.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF01', modulo: 'Avaliação na plataforma', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Convite para a avaliação por link e por e-mail', descricao: 'Link sempre com o domínio publicado; convite por e-mail exato, sem listar contas.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF01', modulo: 'Avaliação na plataforma', sprint: 1, coluna: 'Concluído', em: '2026-10-03' },
  { titulo: 'Central de tutoriais por tela', descricao: 'Tutorial de 11 telas, tour para iniciantes e tutorial completo; progresso salvo por usuário.', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF01', modulo: 'Central de tutoriais', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Recuperação de senha por e-mail', descricao: 'Link de uso único por 1 hora; vale também para contas criadas com o Google.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF05', modulo: 'Autenticação e Onboarding', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Associar login com Google a conta criada com senha', descricao: 'Tela "Você já tem uma conta"; associa depois de confirmar a senha da conta existente.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF05', modulo: 'Autenticação e Onboarding', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Projeto do FlowBot gerenciado dentro do FlowBot', prioridade: 'Baixa', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RF16', modulo: 'Gestão de Requisitos', sprint: 1, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Aba Requisitos com página própria, fora do assistente de criação', descricao: 'O menu abria o assistente de criação, com a trilha de etapas e Voltar/Continuar; agora Requisitos segue o padrão das outras abas e o assistente fica só na criação.', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-09', requisito: 'RF01', modulo: 'Gestão de Requisitos', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Vários responsáveis por card: responsável principal e participantes', descricao: 'O responsável principal responde pela tarefa; os participantes a executam junto. Filtros do Kanban e do relatório encontram a pessoa nos dois papéis.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RF06', modulo: 'Kanban e Sprints', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Convite para o projeto por e-mail ou link', descricao: 'Aba Compartilhamento: convite por e-mail exato (sem listar contas), link de 7 dias que pode ser trocado ou desativado, página de convite antes e depois do login.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RF19', modulo: 'Compartilhamento e cargos', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Visitante só leitura, com as permissões verificadas no servidor', descricao: 'Uma única porta de acesso em todas as rotas do projeto; telas sem botões de edição para quem só vê.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RF20', modulo: 'Compartilhamento e cargos', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Custos e recursos ocultos para o visitante, liberáveis pelo dono', descricao: 'Sem preços, orçamento, aba Recursos nem relatório de custos; o dono libera por pessoa.', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RF21', modulo: 'Compartilhamento e cargos', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Testes automatizados do compartilhamento com duas contas', descricao: 'tests/test_compartilhamento.py: convite, só leitura, custos, remover e sair do projeto.', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-14', requisito: 'RNF02', modulo: 'Qualidade e testes', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Trocar o cargo de quem participa (gestor, funcionário, estagiário)', descricao: 'Seletor de cargo na aba Compartilhamento; ninguém muda o próprio cargo. Estagiário só altera as próprias tarefas e, como o visitante, só vê custos se liberado.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-21', requisito: 'RF20', modulo: 'Compartilhamento e cargos', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Painel de permissões por área do projeto', descricao: 'Oculto / Ver / Editar em cada área, partindo do padrão do cargo.', prioridade: 'Média', prazo: '2026-10-23', requisito: 'RF20', modulo: 'Compartilhamento e cargos', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Sugerir os membros do projeto como responsáveis das tarefas', descricao: 'Com o nome da conta na tarefa, o estagiário a reconhece como sua.', prioridade: 'Média', responsavel: 'Silvio', prazo: '2026-10-23', requisito: 'RF06', modulo: 'Compartilhamento e cargos', sprint: 1, coluna: 'Concluído', em: '2026-10-04' },
  { titulo: 'Registrar RF19 a RF21 e os casos de uso com mais de um ator na documentação', prioridade: 'Alta', prazo: '2026-10-23', requisito: 'RF19', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Configurar SMTP na Vercel para enviar os e-mails de recuperação', descricao: 'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e MAIL_FROM (Gmail com senha de app ou Brevo).', prioridade: 'Alta', prazo: '2026-10-09', requisito: 'RNF05', modulo: 'Autenticação e Onboarding', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Atualizar a lista de convites automaticamente na tela do admin', prioridade: 'Média', prazo: '2026-10-14', requisito: 'RNF01', modulo: 'Avaliação na plataforma', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Normalizar e-mails para evitar contas duplicadas por maiúsculas', prioridade: 'Média', prazo: '2026-10-14', requisito: 'RNF05', modulo: 'Autenticação e Onboarding', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Remover a participação de teste do admin na avaliação', descricao: 'Para não entrar nos resultados do SUS.', prioridade: 'Alta', prazo: '2026-10-23', requisito: 'RNF01', modulo: 'Avaliação na plataforma', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Registrar RF17, RF18 e os módulos novos na documentação técnica', descricao: 'Diagramas, Recursos, avaliação na plataforma, tutoriais, recuperação de senha e associação de contas.', prioridade: 'Alta', prazo: '2026-10-23', requisito: 'RF17', sprint: 1, coluna: 'Backlog' },
  { titulo: 'Homologação da Sprint 2 com o orientador', prioridade: 'Alta', prazo: '2026-10-23', requisito: 'RNF01', modulo: 'Qualidade e testes', sprint: 1, coluna: 'Em Revisão', em: '2026-10-01' },
  // Sprint 3
  { titulo: 'Preparar roteiro de tarefas e questionário SUS', descricao: 'Roteiro de 7 tarefas, SUS em português, perguntas abertas e de perfil, dentro da plataforma.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-27', requisito: 'RNF01', modulo: 'Validação com usuários', sprint: 2, coluna: 'Concluído', em: '2026-10-02' },
  { titulo: 'Recrutar de 8 a 12 participantes', descricao: 'Convites por link e por e-mail pela área Avaliações de usabilidade.', prioridade: 'Alta', prazo: '2026-10-28', requisito: 'RNF01', modulo: 'Validação com usuários', sprint: 2, coluna: 'Em Progresso', em: '2026-10-04' },
  { titulo: 'Aplicar as sessões de avaliação', prioridade: 'Alta', prazo: '2026-11-03', requisito: 'RNF01', modulo: 'Validação com usuários', sprint: 2, coluna: 'Backlog' },
  { titulo: 'Analisar os resultados do SUS e registrar no TCC', prioridade: 'Alta', prazo: '2026-11-06', requisito: 'RNF01', modulo: 'Validação com usuários', sprint: 2, coluna: 'Backlog' },
  { titulo: 'Separar a visão de hardware e de software do projeto', descricao: 'Componentes já são marcados como hardware ou software e há a aba Recursos; falta o ciclo de vida do componente (Sugerido, Aprovado, Comprado).', prioridade: 'Média', prazo: '2026-11-05', requisito: 'RF12', modulo: 'Visão hardware × software', sprint: 2, coluna: 'Em Progresso', em: '2026-10-02' },
  // Sem sprint (trabalhos futuros)
  { titulo: 'Times e hierarquias de acesso por projeto', descricao: 'Convite, cargos e custos ocultos entregues. Falta o painel de permissões por área.', prioridade: 'Alta', responsavel: 'Silvio', prazo: '2026-10-23', requisito: 'RF20', modulo: 'Compartilhamento e cargos', sprint: 1, coluna: 'Em Progresso', em: '2026-10-04' },
];

const ORDEM_COLUNAS: Coluna[] = ['Backlog', 'Em Progresso', 'Em Revisão', 'Concluído'];
const ORDEM_STATUS = ['Planejada', 'Em desenvolvimento', 'Concluída'];

/**
 * Sincroniza um projeto existente com as listas acima sem apagar nada e sem desfazer o que a
 * equipe mudou: cria o que falta, avança o que ficou pronto e redesenha os diagramas de dados.
 */
async function atualizar(projectId: string) {
  const resumo = {
    requisitos: 0,
    requisitosValidados: 0,
    modulos: 0,
    modulosAvancados: 0,
    tarefas: 0,
    tarefasAvancadas: 0,
    tarefasCompletadas: 0,
    diagramas: 0,
  };

  const requisitos = await db.requirement.findMany({ where: { projectId }, select: { id: true, code: true, status: true } });
  const requisitoId = new Map(requisitos.map((r) => [r.code, r.id]));
  for (const [code, description, category, priority, status, level] of REQUISITOS) {
    const existente = requisitos.find((r) => r.code === code);
    if (existente) {
      if (existente.status === 'Em Aberto' && status === 'Validado') {
        await db.requirement.update({ where: { id: existente.id }, data: { status } });
        resumo.requisitosValidados++;
      }
      continue;
    }
    const r = await db.requirement.create({ data: { code, description, category, priority, status, level, projectId }, select: { id: true } });
    requisitoId.set(code, r.id);
    resumo.requisitos++;
  }

  // O módulo de componentes mudou de nome junto com a aba.
  await db.feature.updateMany({ where: { projectId, name: 'Componentes e Custos' }, data: { name: 'Componentes' } });
  const modulos = await db.feature.findMany({ where: { projectId }, select: { id: true, name: true, status: true } });
  const moduloId = new Map(modulos.map((m) => [m.name, m.id]));
  for (const [name, description, status, req] of MODULOS) {
    const atual = modulos.find((m) => m.name === name);
    if (!atual) {
      const f = await db.feature.create({ data: { name, description, status, projectId, requirementId: requisitoId.get(req) }, select: { id: true } });
      moduloId.set(name, f.id);
      resumo.modulos++;
    } else if (ORDEM_STATUS.indexOf(status) > ORDEM_STATUS.indexOf(atual.status)) {
      await db.feature.update({ where: { id: atual.id }, data: { status, description } });
      resumo.modulosAvancados++;
    }
  }

  const colunas = await db.kanbanColumn.findMany({ where: { projectId } });
  const colunaPorNome = new Map(colunas.map((c) => [c.name, c]));
  const sprints = await db.sprint.findMany({ where: { projectId }, orderBy: { startDate: 'asc' }, select: { id: true } });
  const tarefas = await db.task.findMany({
    where: { projectId },
    select: {
      id: true,
      title: true,
      sprintId: true,
      featureId: true,
      requirementId: true,
      dueDate: true,
      column: { select: { name: true } },
    },
  });
  const porTitulo = new Map(tarefas.map((t) => [t.title, t]));

  for (const t of TAREFAS) {
    const destino = colunaPorNome.get(t.coluna);
    if (!destino) continue;
    const existente = porTitulo.get(t.titulo);

    if (!existente) {
      const caminho = ORDEM_COLUNAS.slice(0, ORDEM_COLUNAS.indexOf(t.coluna) + 1).filter((c) => colunaPorNome.has(c));
      const chegada = t.em ? dia(t.em) : new Date();
      const ordem = await db.task.count({ where: { projectId, columnId: destino.id } });
      await db.task.create({
        data: {
          title: t.titulo,
          description: t.descricao,
          priority: t.prioridade,
          assignee: t.responsavel ?? null,
          dueDate: t.prazo ? dia(t.prazo) : null,
          order: ordem,
          columnId: destino.id,
          projectId,
          requirementId: t.requisito ? requisitoId.get(t.requisito) ?? null : null,
          featureId: t.modulo ? moduloId.get(t.modulo) ?? null : null,
          sprintId: t.sprint === undefined ? null : sprints[t.sprint]?.id ?? null,
          history: {
            create: caminho.map((toColumn, i) => ({
              fromColumn: i === 0 ? null : caminho[i - 1],
              toColumn,
              changedAt: new Date(chegada.getTime() - (caminho.length - 1 - i) * 24 * 60 * 60 * 1000),
            })),
          },
        },
      });
      resumo.tarefas++;
      continue;
    }

    // Só avança: uma tarefa que a equipe moveu adiante (ou para outra coluna) não volta.
    const atual = ORDEM_COLUNAS.indexOf(existente.column.name as Coluna);
    if (atual >= 0 && ORDEM_COLUNAS.indexOf(t.coluna) > atual) {
      await db.task.update({
        where: { id: existente.id },
        data: {
          columnId: destino.id,
          ...(t.descricao ? { description: t.descricao } : {}),
          ...(t.responsavel ? { assignee: t.responsavel } : {}),
          history: { create: { fromColumn: existente.column.name, toColumn: t.coluna, changedAt: t.em ? dia(t.em) : new Date() } },
        },
      });
      resumo.tarefasAvancadas++;
    }

    // Completa só o que está vazio (sprint, módulo, requisito, prazo); o que a equipe já
    // preencheu fica como está.
    const vazios = {
      ...(!existente.sprintId && t.sprint !== undefined && sprints[t.sprint] ? { sprintId: sprints[t.sprint].id } : {}),
      ...(!existente.featureId && t.modulo && moduloId.get(t.modulo) ? { featureId: moduloId.get(t.modulo) } : {}),
      ...(!existente.requirementId && t.requisito && requisitoId.get(t.requisito)
        ? { requirementId: requisitoId.get(t.requisito) }
        : {}),
      ...(!existente.dueDate && t.prazo ? { dueDate: dia(t.prazo) } : {}),
    };
    if (Object.keys(vazios).length > 0) {
      await db.task.update({ where: { id: existente.id }, data: vazios });
      resumo.tarefasCompletadas++;
    }
  }

  // Rastreabilidade e cronograma saem dos dados: redesenha para incluir o que mudou.
  const { generateDiagram } = await import('../lib/diagrams-server');
  const project = await db.project.findUnique({ where: { id: projectId }, select: { userId: true } });
  const diagramas = await db.diagram.findMany({ where: { projectId, type: { in: ['traceability', 'gantt'] } } });
  for (const d of diagramas) {
    const { code } = await generateDiagram({ type: d.type, projectId, userId: project!.userId });
    await db.diagram.update({ where: { id: d.id }, data: { code, source: 'dados' } });
    resumo.diagramas++;
  }

  await db.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
  return resumo;
}

async function main() {
  const email = process.argv.find((arg) => arg.includes('@'));
  const recriar = process.argv.includes('--recriar');
  const atualizarProjeto = process.argv.includes('--atualizar');
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
  if (existente && atualizarProjeto) {
    const resumo = await atualizar(existente.id);
    console.log(`Projeto "${PROJECT_NAME}" atualizado para ${user.name ?? email}.`);
    console.log(`  novos: ${resumo.requisitos} requisito(s), ${resumo.modulos} módulo(s), ${resumo.tarefas} tarefa(s)`);
    console.log(`  avançados: ${resumo.modulosAvancados} módulo(s), ${resumo.tarefasAvancadas} tarefa(s); diagramas redesenhados: ${resumo.diagramas}`);
    console.log(`  campos vazios completados em ${resumo.tarefasCompletadas} tarefa(s); requisitos validados: ${resumo.requisitosValidados}`);
    console.log(`  /dashboard/projects/${existente.id}`);
    return;
  }
  if (existente && !recriar) {
    console.log(`O projeto já existe (${existente.id}). Use --atualizar para sincronizar ou --recriar para apagar e criar de novo.`);
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
