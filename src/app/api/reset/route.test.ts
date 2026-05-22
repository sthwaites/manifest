import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const restartMock = vi.fn()
const execSyncMock = vi.fn()

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))

vi.mock("@/lib/codex-server", () => ({
  restartAppServer: restartMock,
}))

vi.mock("child_process", () => ({
  default: { execSync: execSyncMock },
  execSync: execSyncMock,
}))

describe("/api/reset", () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.mockReset()
    restartMock.mockReset()
    execSyncMock.mockReset()
  })

  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null)
    const { POST } = await import("./route")

    const response = await POST()

    expect(response.status).toBe(401)
  })

  it("resets sandbox git state and restarts the app server with a session", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1" } })
    const { POST } = await import("./route")

    const response = await POST()

    expect(response.status).toBe(200)
    expect(execSyncMock).toHaveBeenCalledWith("git reset --hard baseline", expect.objectContaining({ cwd: expect.stringContaining("sandbox") }))
    expect(restartMock).toHaveBeenCalledWith(expect.stringContaining("sandbox"))
    await expect(response.json()).resolves.toEqual({ message: "Sandbox reset to baseline" })
  })
})
