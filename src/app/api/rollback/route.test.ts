import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  execSync: vi.fn(),
  prisma: {
    feature: {
      updateMany: vi.fn(),
    },
  },
  send: vi.fn(),
  restart: vi.fn(),
  resetBridge: vi.fn(),
  beginBridgeOperation: vi.fn(() => ({ ok: true })),
  endBridgeOperation: vi.fn(),
  requestSandboxRestart: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/codex-server", () => ({
  getAppServerClient: vi.fn(() => ({ send: mocks.send })),
  restartAppServer: mocks.restart,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}))

vi.mock("@/lib/ws-bridge", () => ({
  beginBridgeOperation: mocks.beginBridgeOperation,
  endBridgeOperation: mocks.endBridgeOperation,
  resetWebSocketBridgeState: mocks.resetBridge,
}))

vi.mock("@/lib/sandbox-runtime", () => ({
  requestSandboxRestart: mocks.requestSandboxRestart,
}))

vi.mock("child_process", () => ({
  default: { execSync: mocks.execSync },
  execSync: mocks.execSync,
}))

describe("/api/rollback", () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.auth.mockReset()
    mocks.send.mockReset()
    mocks.restart.mockReset()
    mocks.resetBridge.mockReset()
    mocks.beginBridgeOperation.mockReset()
    mocks.beginBridgeOperation.mockReturnValue({ ok: true })
    mocks.endBridgeOperation.mockReset()
    mocks.requestSandboxRestart.mockReset()
    mocks.execSync.mockReset()
    mocks.prisma.feature.updateMany.mockReset()
  })

  it("returns 401 without a session", async () => {
    mocks.auth.mockResolvedValue(null)
    const { POST } = await import("./route")

    const response = await POST(new Request("http://localhost/api/rollback", { method: "POST", body: "{}" }))

    expect(response.status).toBe(401)
  })

  it("uses HEAD when the sandbox working tree is dirty", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user_1" } })
    mocks.prisma.feature.updateMany.mockResolvedValue({ count: 1 })
    mocks.execSync.mockImplementation((command: string) => {
      if (command === "git status --porcelain") return " M src/app/globals.css\n"
      return ""
    })
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/rollback", {
        method: "POST",
        body: JSON.stringify({ threadId: "thread_1" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ method: "thread/rollback" }))
    expect(mocks.execSync).toHaveBeenCalledWith("git reset --hard HEAD", expect.objectContaining({ cwd: expect.stringContaining("sandbox") }))
    expect(mocks.prisma.feature.updateMany).toHaveBeenCalledWith({
      where: { threadId: "thread_1", status: { in: ["pending", "applied"] } },
      data: { status: "rolled_back" },
    })
    await expect(response.json()).resolves.toEqual({ message: "Rolled back to previous state" })
  })

  it("uses the matching thread commit when the sandbox is clean", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user_1" } })
    mocks.prisma.feature.updateMany.mockResolvedValue({ count: 1 })
    mocks.execSync.mockImplementation((command: string) => {
      if (command === "git status --porcelain") return ""
      if (command === "git rev-parse HEAD") return "commit_2\n"
      if (command === "git rev-parse baseline") return "commit_1\n"
      if (command === "git log --grep='thread:thread_1' -n 1 --format=%H") return "commit_2\n"
      return ""
    })
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/rollback", {
        method: "POST",
        body: JSON.stringify({ threadId: "thread_1" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.execSync).toHaveBeenCalledWith("git reset --hard commit_2^", expect.objectContaining({ cwd: expect.stringContaining("sandbox") }))
    expect(mocks.prisma.feature.updateMany).toHaveBeenCalledWith({
      where: { threadId: "thread_1", status: { in: ["pending", "applied"] } },
      data: { status: "rolled_back" },
    })
    await expect(response.json()).resolves.toEqual({ message: "Rolled back to previous state" })
  })

  it("returns a no-op response when the sandbox is clean at baseline", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user_1" } })
    mocks.prisma.feature.updateMany.mockResolvedValue({ count: 1 })
    mocks.execSync.mockImplementation((command: string) => {
      if (command === "git status --porcelain") return ""
      if (command === "git rev-parse HEAD") return "commit_1\n"
      if (command === "git rev-parse baseline") return "commit_1\n"
      return ""
    })
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/rollback", {
        method: "POST",
        body: JSON.stringify({ threadId: "thread_1" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.execSync).not.toHaveBeenCalledWith("git reset --hard HEAD", expect.anything())
    expect(mocks.execSync).not.toHaveBeenCalledWith("git reset --hard HEAD~1", expect.anything())
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.prisma.feature.updateMany).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ message: "No sandbox changes to roll back" })
  })

  it("does not mark features rolled back when no matching sandbox rollback happened", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user_1" } })
    mocks.prisma.feature.updateMany.mockResolvedValue({ count: 1 })
    mocks.execSync.mockImplementation((command: string) => {
      if (command === "git status --porcelain") return ""
      if (command === "git rev-parse HEAD") return "commit_1\n"
      if (command === "git rev-parse baseline") return "commit_2\n"
      if (command === "git log --grep='thread:thread_1' -n 1 --format=%H") return ""
      if (command === "git merge-base --is-ancestor baseline HEAD") throw new Error("not ahead")
      return ""
    })
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/rollback", {
        method: "POST",
        body: JSON.stringify({ threadId: "thread_1" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.execSync).not.toHaveBeenCalledWith("git reset --hard HEAD~1", expect.anything())
    expect(mocks.prisma.feature.updateMany).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ message: "No sandbox changes to roll back" })
  })

  it("returns a JSON error when a git command fails", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user_1" } })
    mocks.execSync.mockImplementation((command: string) => {
      if (command === "git status --porcelain") return " M src/app/globals.css\n"
      if (command === "git reset --hard HEAD") throw new Error("reset failed")
      return ""
    })
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/rollback", {
        method: "POST",
        body: JSON.stringify({ threadId: "thread_1" }),
      }),
    )

    expect(response.status).toBe(500)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.prisma.feature.updateMany).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: "Rollback failed", detail: "reset failed" })
  })
})
