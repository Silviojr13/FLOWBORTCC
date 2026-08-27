import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { tursoDb } from "./lib/turso-db";
import { compare } from "bcrypt";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(tursoDb),
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