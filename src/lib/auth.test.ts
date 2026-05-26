import { beforeEach, describe, expect, it, vi } from "vitest"

type NextAuthConfig = {
  providers: unknown[]
}

let capturedConfig: NextAuthConfig | null = null

vi.mock("next-auth", () => ({
  default: (config: NextAuthConfig) => {
    capturedConfig = config
    return {
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    }
  },
}))

vi.mock("next-auth/providers/auth0", () => ({
  default: vi.fn(() => ({ id: "auth0" })),
}))

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((config: unknown) => ({ id: "credentials", config })),
}))

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}))

vi.mock("./prisma", () => ({
  prisma: {},
}))

describe("auth configuration", () => {
  beforeEach(() => {
    capturedConfig = null
    vi.resetModules()
  })

  it("uses debug auth when DEBUG_AUTH is enabled", async () => {
    const previous = process.env.DEBUG_AUTH
    process.env.DEBUG_AUTH = "true"

    try {
      const authModule = await import("./auth")

      expect(authModule.auth).toBeTypeOf("function")
      expect(authModule.signIn).toBeTypeOf("function")
      expect(authModule.signOut).toBeTypeOf("function")
      expect(capturedConfig?.providers).toHaveLength(1)
    } finally {
      process.env.DEBUG_AUTH = previous
    }
  })

  it("reports missing Auth0 configuration when debug auth is disabled", async () => {
    const previous = {
      DEBUG_AUTH: process.env.DEBUG_AUTH,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
      AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
      AUTH0_ISSUER: process.env.AUTH0_ISSUER,
    }

    process.env.DEBUG_AUTH = "false"
    delete process.env.NEXTAUTH_SECRET
    process.env.NEXTAUTH_URL = "http://localhost:3000"
    process.env.AUTH0_CLIENT_ID = "client-id"
    process.env.AUTH0_CLIENT_SECRET = "client-secret"
    process.env.AUTH0_ISSUER = "https://example.auth0.com"

    try {
      const authModule = await import("./auth")

      expect(authModule.getAuthConfigIssue()).toBe("NEXTAUTH_SECRET is not set.")
    } finally {
      Object.entries(previous).forEach(([key, value]) => {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      })
    }
  })

  it("accepts complete Auth0 configuration", async () => {
    const previous = {
      DEBUG_AUTH: process.env.DEBUG_AUTH,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
      AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
      AUTH0_ISSUER: process.env.AUTH0_ISSUER,
    }

    process.env.DEBUG_AUTH = "false"
    process.env.NEXTAUTH_SECRET = "secret"
    process.env.NEXTAUTH_URL = "http://localhost:3000"
    process.env.AUTH0_CLIENT_ID = "client-id"
    process.env.AUTH0_CLIENT_SECRET = "client-secret"
    process.env.AUTH0_ISSUER = "https://example.auth0.com"

    try {
      const authModule = await import("./auth")

      expect(authModule.getAuthConfigIssue()).toBeNull()
    } finally {
      Object.entries(previous).forEach(([key, value]) => {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      })
    }
  })
})
