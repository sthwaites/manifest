import { beforeEach, describe, expect, it, vi } from "vitest"

const createMock = vi.fn()

vi.mock("openai", () => ({
  default: vi.fn(() => ({
    moderations: {
      create: createMock,
    },
  })),
}))

describe("moderation", () => {
  beforeEach(() => {
    vi.resetModules()
    createMock.mockReset()
  })

  it("resolves for a clean prompt", async () => {
    createMock.mockResolvedValue({
      results: [{ flagged: false, categories: {} }],
    })
    const { checkModeration } = await import("./moderation")

    await expect(checkModeration("add search")).resolves.toBeUndefined()
  })

  it("throws ModerationError with a flagged category", async () => {
    createMock.mockResolvedValue({
      results: [{ flagged: true, categories: { violence: true, hate: false } }],
    })
    const { ModerationError, checkModeration } = await import("./moderation")

    await expect(checkModeration("bad prompt")).rejects.toThrow(ModerationError)
    await expect(checkModeration("bad prompt")).rejects.toThrow("violence")
  })

  it("includes multiple flagged categories in the error message", async () => {
    createMock.mockResolvedValue({
      results: [{ flagged: true, categories: { violence: true, self_harm: true, hate: false } }],
    })
    const { checkModeration } = await import("./moderation")

    await expect(checkModeration("bad prompt")).rejects.toThrow("violence, self_harm")
  })
})
