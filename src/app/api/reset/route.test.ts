import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  execSync: vi.fn(),
  resetBridge: vi.fn(),
  restart: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/codex-server", () => ({
  restartAppServer: mocks.restart,
}))

vi.mock("@/lib/ws-bridge", () => ({
  resetWebSocketBridgeState: mocks.resetBridge,
}))

vi.mock("child_process", () => ({
  default: { execSync: mocks.execSync },
  execSync: mocks.execSync,
}))

describe("/api/reset", () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.auth.mockReset()
    mocks.resetBridge.mockReset()
    mocks.restart.mockReset()
    mocks.execSync.mockReset()
  })

  it("returns 401 without a session", async () => {
    mocks.auth.mockResolvedValue(null)
    const { POST } = await import("./route")

    const response = await POST()

    expect(response.status).toBe(401)
  })

  it("resets sandbox git state and restarts the app server with a session", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user_1" } })
    const { POST } = await import("./route")

    const response = await POST()

    expect(response.status).toBe(200)
    expect(mocks.execSync).toHaveBeenCalledWith("git reset --hard baseline", expect.objectContaining({ cwd: expect.stringContaining("sandbox") }))
    expect(mocks.execSync).toHaveBeenCalledWith("git clean -fd", expect.objectContaining({ cwd: expect.stringContaining("sandbox") }))
    expect(mocks.resetBridge).toHaveBeenCalled()
    expect(mocks.restart).toHaveBeenCalledWith(expect.stringContaining("sandbox"))
    await expect(response.json()).resolves.toEqual({ message: "Sandbox reset to baseline" })
  })

  it("returns a JSON error when reset fails", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user_1" } })
    mocks.execSync.mockImplementation((command: string) => {
      if (command === "git reset --hard baseline") throw new Error("reset failed")
      return ""
    })
    const { POST } = await import("./route")

    const response = await POST()

    expect(response.status).toBe(500)
    expect(mocks.resetBridge).not.toHaveBeenCalled()
    expect(mocks.restart).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: "Reset failed", detail: "reset failed" })
  })
})
