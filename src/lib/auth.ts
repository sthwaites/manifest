import { PrismaAdapter } from "@auth/prisma-adapter"
import { redirect } from "next/navigation"
import type { Session } from "next-auth"
import NextAuth from "next-auth"
import Auth0 from "next-auth/providers/auth0"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"

const debugAuth = process.env.DEBUG_AUTH === "true"

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0)
}

function hasValidUrl(value: string | undefined) {
  if (!hasValue(value)) return false

  try {
    new URL(value as string)
    return true
  } catch {
    return false
  }
}

export function getAuthConfigIssue() {
  if (debugAuth) return null

  if (!hasValue(process.env.NEXTAUTH_SECRET)) return "NEXTAUTH_SECRET is not set."
  if (!hasValidUrl(process.env.NEXTAUTH_URL)) return "NEXTAUTH_URL must be a valid URL."
  if (!hasValue(process.env.AUTH0_CLIENT_ID)) return "AUTH0_CLIENT_ID is not set."
  if (!hasValue(process.env.AUTH0_CLIENT_SECRET)) return "AUTH0_CLIENT_SECRET is not set."
  if (!hasValidUrl(process.env.AUTH0_ISSUER)) return "AUTH0_ISSUER must be a valid URL."

  return null
}

const nextAuth = NextAuth({
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

export const handlers = nextAuth.handlers
export const signOut = nextAuth.signOut

export async function auth(): Promise<Session | null> {
  if (debugAuth) {
    return {
      user: {
        id: "debug-user",
        email: "dev@localhost",
        name: "Dev User",
      },
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    }
  }

  return nextAuth.auth()
}

export async function signIn(provider?: string, options?: { redirectTo?: string }) {
  if (debugAuth) {
    redirect(options?.redirectTo ?? "/catalogue")
  }

  return nextAuth.signIn(provider, options)
}
