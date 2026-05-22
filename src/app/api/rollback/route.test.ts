import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const sendMock = vi.fn()
const execSyncMock = vi.fn()
const prismaMock = vi.hoisted(() => ({
  feature: {
    updateMany: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))

vi.mock("@/lib/codex-server", () => ({
  getAppServerClient: vi.fn(() => ({ send: sendMock })),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("child_process", () => ({
  default: { execSync: execSyncMock },
  execSync: execSyncMock,
}))

describe("/api/rollback", () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.mockReset()
    sendMock.mockReset()
    execSyncMock.mockReset()
    prismaMock.feature.updateMany.mockReset()
  })

  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null)
    const { POST } = await import("./route")

    const response = await POST(new Request("http://localhost/api/rollback", { method: "POST", body: "{}" }))

    expect(response.status).toBe(401)
  })

  it("rolls back app server and sandbox git state with a session", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1" } })
    prismaMock.feature.updateMany.mockResolvedValue({ count: 1 })
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/rollback", {
        method: "POST",
        body: JSON.stringify({ threadId: "thread_1" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ method: "thread/rollback" }))
    expect(execSyncMock).toHaveBeenCalledWith("git reset --hard HEAD~1", expect.objectContaining({ cwd: expect.stringContaining("sandbox") }))
    await expect(response.json()).resolves.toEqual({ message: "Rolled back to previous state" })
  })
})
