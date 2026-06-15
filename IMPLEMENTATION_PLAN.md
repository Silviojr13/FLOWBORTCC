# Plano de Implementação - FlowBot

## Resumo Executivo

Este plano descreve a implementação de um sistema completo de autenticação com Prisma ORM e banco de dados Turso, incluindo login com Google e persistência das conversas do Gemma AI. A solução será integrada ao projeto Next.js existente, mantendo a estrutura App Router e seguindo as melhores práticas de arquitetura moderna.

## Arquitetura Atual

Análise da estrutura atual do projeto:

- **Framework**: Next.js (versão provavelmente 13+ baseado na estrutura App Router)
- **Router**: App Router (baseado na presença de `useRouter` do `next/navigation`)
- **Componentes UI**: Biblioteca de componentes reutilizáveis (`ui/*`)
- **Autenticação**: Parcialmente implementada (componente de login redireciona para `/dashboard` sem verificação real)
- **Banco de dados**: Aparentemente ausente (nenhuma integração visível no código atual)
- **Integração IA**: Referência à Gemma AI (possivelmente configurada nos arquivos `.env` e `/api`)
- **Estrutura**: Componentes organizados em `/components`, utilitários em `/lib/utils`
- **Frontend**: Formulário de login funcional com campos de email/senha e opções de login social

## Arquitetura Proposta

Após as implementações, o projeto terá:

- **ORM**: Prisma ORM com cliente configurado
- **Banco de dados**: Turso (compatível com SQLite/PlanetScale)
- **Autenticação**: NextAuth.js com provedor Google
- **Modelos de dados**: Usuários, chats e mensagens
- **Persistência**: Conversas do Gemma AI salvas no banco
- **Segurança**: Sessões seguras e proteção de rotas
- **Tipagem**: TypeScript completo com tipos definidos

## Dependências Necessárias

```bash
# ORM e banco de dados
npm install @prisma/client
npm install prisma --save-dev
npm install @libsql/client

# Autenticação
npm install next-auth
npm install @auth/prisma-adapter

# Provedores OAuth
npm install @auth/google-oidc-provider

# Tipagem
npm install @types/node --save-dev
```

## Variáveis de Ambiente

Com base na menção de integração existente nos arquivos `.env` e pastas `/api`, as seguintes variáveis serão adicionadas/verificadas:

```env
# Banco de dados Turso
DATABASE_URL="libsql://your-db-name.turso.io"

# Chaves de autenticação do Google
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Chave de autenticação NextAuth
NEXTAUTH_SECRET=""

# URL base do aplicativo
NEXTAUTH_URL="http://localhost:3000"

# Configurações da API do Gemma AI
GEMMA_API_KEY=""
GEMMA_MODEL_NAME="gemma"
GEMMA_API_URL="https://generativelanguage.googleapis.com/v1beta/models"
```

## Alterações de Banco de Dados

### Modelo Prisma (schema.prisma)

```prisma
model User {
  id           String    @id @default(cuid())
  name         String?
  email        String?   @unique
  emailVerified DateTime?
  image        String?
  provider     String?   // google, credentials, etc
  providerId   String?   // ID do provedor OAuth
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  chats        Chat[]
  
  @@map("users")
}

model Account {
  id                 String  @id @default(cuid())
  userId             String
  type               String
  provider           String
  providerAccountId  String
  refresh_token      String?
  access_token       String?
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String?
  session_state      String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("sessions")
}

model Chat {
  id          String    @id @default(cuid())
  title       String
  userId      String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  user        User      @relation(fields: [userId], references: [id])
  messages    Message[]
  
  @@map("chats")
}

model Message {
  id         String   @id @default(cuid())
  chatId     String
  role       String   // 'user', 'assistant', 'system'
  content    String
  createdAt  DateTime @default(now())
  
  chat       Chat     @relation(fields: [chatId], references: [id], onDelete: Cascade)
  
  @@map("messages")
}
```

## Tasks

### Task 1 - Configuração do Prisma e Banco de Dados
- **Objetivo**: Configurar Prisma ORM com cliente reutilizável e conectar ao Turso
- **Arquivos afetados**: package.json, prisma/schema.prisma, lib/db.ts
- **Dependências**: @prisma/client, @libsql/client, prisma
- **Critérios de aceite**: Cliente Prisma funcional, conexão com Turso testada
- **Riscos**: Conflitos de versão com outras dependências
- **Estimativa de impacto**: Média

### Task 2 - Integração com Turso
- **Objetivo**: Configurar banco de dados Turso com variáveis de ambiente
- **Arquivos afetados**: .env, .env.local, prisma/schema.prisma
- **Dependências**: @libsql/client
- **Critérios de aceite**: Conexão com banco Turso estabelecida e testada
- **Riscos**: Configuração incorreta de credenciais
- **Estimativa de impacto**: Baixa

### Task 3 - Modelagem do banco de dados
- **Objetivo**: Criar modelos de usuário, chat e mensagem com relacionamentos
- **Arquivos afetados**: prisma/schema.prisma
- **Dependências**: Prisma CLI
- **Critérios de aceite**: Schema completo com todos os modelos e relacionamentos
- **Riscos**: Erros de relacionamento entre entidades
- **Estimativa de impacto**: Média

### Task 4 - Sistema de autenticação
- **Objetivo**: Implementar NextAuth.js com provedor de credenciais e Google
- **Arquivos afetados**: app/api/auth/[...nextauth]/route.ts, lib/auth.ts
- **Dependências**: next-auth, @auth/prisma-adapter
- **Critérios de aceite**: Login/logout funcionando, sessão persistida no banco
- **Riscos**: Configuração incorreta de provedores OAuth
- **Estimativa de impacto**: Alta

### Task 5 - Login Google
- **Objetivo**: Adicionar login com Google ao formulário de login
- **Arquivos afetados**: components/login-form.tsx, app/api/auth/[...nextauth]/route.ts
- **Dependências**: @auth/google-oidc-provider
- **Critérios de aceite**: Botão de login Google funcional, usuário criado automaticamente
- **Riscos**: Configuração incorreta de credenciais OAuth
- **Estimativa de impacto**: Média

### Task 6 - Persistência das conversas
- **Objetivo**: Salvar e recuperar conversas do Gemma AI no banco de dados
- **Arquivos afetados**: lib/db.ts, services/chat-service.ts, components/chat-component.tsx, app/api/chat/route.ts
- **Dependências**: @prisma/client
- **Critérios de aceite**: Conversas salvas automaticamente, histórico carregado corretamente
- **Riscos**: Problemas de sincronização de estado
- **Estimativa de impacto**: Alta

### Task 7 - Testes e validação
- **Objetivo**: Validar toda a funcionalidade implementada
- **Arquivos afetados**: Testes unitários e integração
- **Dependências**: Testing libraries (jest, react-testing-library)
- **Critérios de aceite**: Todos os fluxos funcionando conforme especificado
- **Riscos**: Falhas não detectadas em ambientes diferentes
- **Estimativa de impacto**: Baixa

---

**Status**: Aguardando aprovação para início da implementação.