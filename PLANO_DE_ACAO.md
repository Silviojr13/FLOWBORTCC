# PLANO DE AÇÃO — Implementação Completa

## Status Atual
O projeto já tem uma base sólida implementada:
- ✅ Prisma 7.8.0 configurado com Driver Adapter para Turso
- ✅ Banco de dados Turso (LibSQL) conectado e funcionando
- ✅ Modelos criados no schema.prisma: User, Account, Session, Chat, Message
- ✅ Tabelas já criadas no banco Turso remoto
- ✅ Arquivo lib/db.ts com configuração do PrismaClient com Driver Adapter
- ✅ Variáveis de ambiente configuradas (.env)
- ✅ Integração com modelo Gemini AI implementada
- ✅ Componente de chatbot funcional
- ✅ API route para comunicação com Gemini
- ✅ Página de login básica criada

O que está pendente ou incompleto:
- ❌ Integração do NextAuth com Google Provider
- ❌ Persistência dos dados de login no banco de dados
- ❌ Integração da persistência de conversas no banco de dados
- ❌ Redirecionamento após login/logout
- ❌ Proteção de rotas que exigem autenticação

## Dependências Necessárias
As seguintes dependências precisam ser instaladas:
- `next-auth`: "^5.0.0" para autenticação (Auth.js v5 compatível com App Router)
- `@auth/prisma-adapter`: "^2.7.4" para integração com Prisma

## TASK 1 — Validação e Consolidação do Prisma + Turso
### Objetivo
Validar que a conexão com o banco de dados Turso está funcionando corretamente e consolidar a configuração do Prisma para garantir que todos os modelos estejam compatíveis com o NextAuth.

### Arquivos envolvidos
- `prisma/schema.prisma`
- `lib/db.ts`
- `.env`

### Subtasks detalhadas
1. Validar que todos os modelos são compatíveis com o PrismaAdapter do NextAuth
2. Verificar se os campos obrigatórios do NextAuth estão presentes
3. Testar a conexão com o banco de dados Turso
4. Confirmar que o Driver Adapter está funcionando corretamente

### Critério de conclusão
- Conexão com Turso está estável
- Todos os modelos estão prontos para receber dados do NextAuth
- Schema está validado e funcional

## TASK 3 — Modelo de Login no Banco de Dados
### Objetivo
Garantir que os modelos de banco de dados (User, Account, Session) estejam corretamente configurados para armazenar os dados do NextAuth.

### Verificação dos modelos existentes (User, Account, Session)
- Modelo User: Verificar campos obrigatórios e relacionamentos
- Modelo Account: Verificar campos para armazenar tokens OAuth
- Modelo Session: Verificar campos para armazenar token de sessão

### Ajustes necessários no schema.prisma se houver incompatibilidade com NextAuth
- Adicionar campos opcionais que o NextAuth espera
- Ajustar tipos de dados se necessário
- Garantir que os relacionamentos estejam corretos

### Subtasks detalhadas
1. Validar modelos contra a documentação do PrismaAdapter
2. Fazer ajustes necessários no schema
3. Executar migrações necessárias
4. Testar a criação de usuários via NextAuth

### Critério de conclusão
- Modelos estão compatíveis com NextAuth
- Dados de autenticação são persistidos corretamente
- Relacionamentos entre modelos estão funcionando

## TASK 2 — Implementação do NextAuth com Provider Google
### Objetivo
Implementar o sistema de autenticação com Google usando NextAuth.js v5 e integrar com o PrismaAdapter para persistência de dados.

### Pré-requisitos (credenciais OAuth necessárias no .env)
- `GOOGLE_CLIENT_ID`: ID do cliente Google OAuth
- `GOOGLE_CLIENT_SECRET`: Segredo do cliente Google OAuth
- `NEXTAUTH_SECRET`: Segredo para assinatura de JWT
- `NEXTAUTH_URL`: URL base da aplicação

### Arquivos que serão criados/modificados
- `lib/auth.ts` (função para obter a sessão do usuário)
- `app/api/auth/[...nextauth]/route.ts` (configuração do NextAuth)
- `.env` (adicionando valores para as credenciais faltantes)

### Subtasks detalhadas
1. Criar o arquivo de configuração do NextAuth
2. Configurar o provedor Google
3. Configurar o PrismaAdapter
4. Verificar compatibilidade do @auth/prisma-adapter com o Driver Adapter do Turso
5. Documentar qualquer adaptação necessária
6. Definir as estratégias de callback
7. Atualizar as variáveis de ambiente

### Critério de conclusão
- Autenticação Google está funcionando
- Sessão do usuário está sendo persistida no banco de dados
- Rotas de callback do Google estão funcionando corretamente
- Compatibilidade com Driver Adapter confirmada/documentada

## TASK 4 — Tela de Login com Integração Google
### Objetivo
Atualizar a tela de login existente para usar o NextAuth para autenticação com Google.

### Arquivos que serão criados/modificados
- `components/login-form.tsx` (atualizar botões e lógica de login)
- `app/login/page.tsx` (manter estrutura atual)
- `lib/auth.ts` (funções de helper para autenticação)

### Layout e componentes necessários
- Botão de login com Google funcional
- Feedback visual durante o processo de login
- Redirecionamento após login bem-sucedido
- Tratamento de erros de autenticação

### Subtasks detalhadas
1. Atualizar o componente LoginForm para usar signIn do NextAuth
2. Implementar feedback visual durante o login
3. Adicionar redirecionamento após login
4. Implementar tratamento de erros

### Critério de conclusão
- Botão de login com Google está funcional
- Usuário é redirecionado após login
- Feedback visual está adequado
- Erros de autenticação são tratados corretamente

## TASK 5 — Salvamento de Mensagens do Gemma AI no Banco
### Objetivo
Integrar a persistência de conversas e mensagens no banco de dados, ligando-as ao usuário autenticado.

### Localização atual do código do Gemma AI no projeto
- `app/api/chat/route.ts`: API route que comunica com Gemini
- `components/chatbot.tsx`: Componente que exibe o chat

### Arquivos que serão criados/modificados
- `app/api/chat/route.ts` (modificar para salvar mensagens no banco)
- `components/chatbot.tsx` (atualizar para carregar conversas do banco)
- `lib/auth.ts` (funções para obter usuário autenticado)
- Novos componentes para carregar/salvar conversas do banco

### Fluxo: usuário envia mensagem → Gemma responde → ambos salvos no banco
1. Identificar usuário autenticado
2. Criar/atualizar conversa no banco
3. Salvar mensagem do usuário no banco
4. Receber resposta do Gemini
5. Salvar mensagem da IA no banco
6. Retornar resposta para o frontend

### Subtasks detalhadas
1. Modificar rota de API para integrar com banco de dados
2. Atualizar componente de chat para carregar conversas salvas
3. Implementar funções de acesso ao banco para manipular conversas
4. Garantir que apenas usuários autenticados possam acessar suas conversas

### Critério de conclusão
- Mensagens são salvas no banco de dados 
- Conversas são associadas ao usuário autenticado
- Usuário pode ver conversas anteriores após login
- Apenas proprietário da conversa pode acessá-la

## TASK 6 — Proteção de Rotas com Middleware
### Objetivo
Implementar proteção de rotas usando middleware para controlar o acesso às páginas com base na autenticação do usuário.

### Arquivos que serão criados/modificados
- `middleware.ts` (middleware para proteger rotas)
- `lib/auth.ts` (funções auxiliares para verificação de autenticação)

### Funcionalidades
- Redirecionar para /login se usuário não autenticado tentar acessar rotas protegidas
- Redirecionar para / se usuário autenticado tentar acessar /login
- Definir quais rotas são públicas e quais são protegidas

### Subtasks detalhadas
1. Criar arquivo middleware.ts na raiz do projeto
2. Configurar rotas protegidas (ex: /dashboard, /chat, etc.)
3. Configurar rotas públicas (ex: /login, /api/auth/*, etc.)
4. Implementar lógica de redirecionamento
5. Testar proteção de rotas

### Critério de conclusão
- Rotas protegidas redirecionam usuários não autenticados para /login
- Usuários autenticados são redirecionados se tentarem acessar /login
- Rotas públicas continuam acessíveis

## Ordem de Execução Recomendada
1. **TASK 1** - Validar e consolidar Prisma + Turso (base para todas as outras tarefas)
2. **TASK 3** - Ajustar modelos para NextAuth (garante persistência de login antes de configurar NextAuth)
3. **TASK 2** - Implementar NextAuth com Google (base para autenticação)
4. **TASK 4** - Atualizar tela de login (interface para autenticação)
5. **TASK 5** - Integrar persistência de conversas (funcionalidade adicional)
6. **TASK 6** - Proteção de rotas com middleware (segurança da aplicação)

Essa ordem é lógica porque cada tarefa depende dos resultados da anterior. Primeiro precisamos garantir que o banco de dados está funcionando corretamente, depois ajustamos os modelos para o NextAuth, implementamos a autenticação, atualizamos a interface, integramos a persistência de conversas e finalmente implementamos a proteção de rotas.

## Riscos e Pontos de Atenção
1. **Compatibilidade do schema com NextAuth**: Os modelos atuais podem precisar de ajustes para serem compatíveis com o PrismaAdapter
2. **Compatibilidade Driver Adapter x PrismaAdapter**: Pode haver incompatibilidades entre o Driver Adapter do Turso e o PrismaAdapter do NextAuth
3. **Credenciais OAuth**: Será necessário obter credenciais válidas do Google Cloud Console
4. **Performance**: A integração com banco de dados pode impactar a performance da API de chat
5. **Segurança**: É importante garantir que usuários só possam acessar suas próprias conversas
6. **Erros de ambiente**: Problemas com variáveis de ambiente podem ocorrer em diferentes ambientes