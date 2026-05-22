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
})
