import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { tursoDb } from "./lib/turso-db";
import { compare } from "bcrypt";
import { routeGoogleSignIn } from "./lib/account-link";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(tursoDb),
  // Sem trustHost, o NextAuth monta as URLs absolutas (callback do OAuth e redirecionamento
  // pós-login) a partir de NEXTAUTH_URL. Como essa variável apontava para localhost na
  // Vercel, o login com Google devolvia o usuário para http://localhost:3000.
  // Com trustHost, a origem vem do próprio pedido (host / x-forwarded-host), então a
  // aplicação funciona em produção, nas prévias e em desenvolvimento sem depender da
  // variável — a Vercel garante esses cabeçalhos.
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("Credenciais ausentes no authorize:", credentials);
          return null;
        }

        try {
          // Procura o usuário pelo e-mail
          const user = await tursoDb.user.findUnique({
            where: { email: credentials.email as string }
          });

          if (!user || !user.password) {
            console.log("Usuário não encontrado ou sem senha:", credentials.email);
            return null;
          }

          // Compara a senha fornecida com a senha hash armazenada
          const isValid = await compare(credentials.password as string, user.password);

          if (isValid) {
            console.log("Autenticação bem-sucedida para o usuário:", user.email);
            // Retornar o usuário completo para garantir que todas as propriedades necessárias estejam presentes
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image || null
            };
          } else {
            console.log("Senha inválida para o usuário:", user.email);
            return null;
          }
        } catch (error) {
          console.error("Erro durante autorização:", error);
          return null;
        }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // Login com Google num e-mail que já tem conta com senha: em vez do bloqueio genérico
    // do NextAuth, leva à tela que explica a situação e associa as contas após a pessoa
    // confirmar a senha. Roda antes da criação/vinculação automática do adaptador.
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const destino = await routeGoogleSignIn({
        email: profile?.email,
        emailVerified: profile?.email_verified !== false,
        providerAccountId: account.providerAccountId,
        type: account.type,
      });
      return destino ?? true;
    },
    async jwt({ token, user }) {
      // Quando o usuário faz login, o objeto user é adicionado ao token
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      // Passar as informações do token para a sessão
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.email = token.email as string;
        session.user.image = token.picture;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});