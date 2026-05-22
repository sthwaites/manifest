import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"
import Auth0 from "next-auth/providers/auth0"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"

const debugAuth = process.env.DEBUG_AUTH === "true"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: debugAuth
    ? [
        Credentials({
          credentials: {},
          authorize: async () => ({
            id: "debug-user",
            email: "dev@localhost",
            name: "Dev User",
          }),
        }),
      ]
    : [
        Auth0({
          clientId: process.env.AUTH0_CLIENT_ID ?? "",
          clientSecret: process.env.AUTH0_CLIENT_SECRET ?? "",
          issuer: process.env.AUTH0_ISSUER,
        }),
      ],
  pages: { signIn: "/login" },
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
})
