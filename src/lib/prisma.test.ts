import { describe, expect, it } from "vitest"
import { prisma } from "./prisma"

describe("prisma", () => {
  it("exports a singleton client", async () => {
    const imported = await import("./prisma")

    expect(imported.prisma).toBe(prisma)
  })
})
