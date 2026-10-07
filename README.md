This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Ambiente de desenvolvimento

Cada integrante desenvolve com um ambiente próprio: banco SQLite local, segredo de login
próprio e a sua chave da IA. As chaves de produção ficam só na Vercel e não são compartilhadas.

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie o seu `.env` a partir do modelo:
   ```bash
   cp .env.example .env
   ```
3. No `.env`, preencha:
   - `AUTH_SECRET` e `NEXTAUTH_SECRET` com um valor gerado por `openssl rand -base64 32`;
   - `GROQ_API_KEY` com a sua chave gratuita de https://console.groq.com/keys (só para usar a IA).
4. Monte o banco local, com todas as tabelas, uma conta de teste e o projeto de exemplo:
   ```bash
   npm run dev:setup
   ```
5. Rode o FlowBot e entre em http://localhost:3000 com `dev@flowbot.local` / `flowbot-dev`:
   ```bash
   npm run dev
   ```

O `dev.db` fica só no seu computador (o Git o ignora). Rodar `npm run dev:setup` de novo
sincroniza as tabelas depois de mudanças no `prisma/schema.prisma`, sem apagar seus dados.
O script se recusa a rodar se o `DATABASE_URL` apontar para o Turso.

Login com Google em desenvolvimento precisa de um cliente OAuth próprio, com
`http://localhost:3000` como origem; sem ele, use e-mail e senha.

## Banco de dados

Prisma ORM com libSQL: em desenvolvimento, um arquivo SQLite (`dev.db`); em produção, o
Turso, configurado só nas variáveis de ambiente da Vercel.

## E-mail (recuperação de senha)

O link de recuperação de senha é enviado por SMTP. Configure no `.env` (local) e nas
variáveis de ambiente da Vercel (produção):

```
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="conta-que-envia@gmail.com"
SMTP_PASS="senha de app de 16 letras"
MAIL_FROM="FlowBot <conta-que-envia@gmail.com>"
```

- **Gmail**: ative a verificação em duas etapas na conta e gere uma *senha de app* em
  myaccount.google.com/apppasswords; use-a em `SMTP_PASS` (a senha normal não funciona).
- **Brevo** (300 e-mails/dia grátis): `SMTP_HOST="smtp-relay.brevo.com"`, usuário e chave
  SMTP do painel, e um remetente verificado em `MAIL_FROM`.

Sem SMTP configurado, em desenvolvimento o e-mail aparece no terminal do servidor; em
produção o envio falha e o erro fica no log da Vercel. A tabela dos links é criada com
`npm run script:alter-password-reset`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Prisma Documentation](https://www.prisma.io/docs) - learn about Prisma ORM.
- [Turso Documentation](https://docs.turso.tech) - learn about Turso database.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.