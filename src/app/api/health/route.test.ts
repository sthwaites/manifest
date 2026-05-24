import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  appServerStatus: vi.fn(),
  bridgeStatus: vi.fn(),
}))

vi.mock("@/lib/codex-server", () => ({
  getAppServerStatus: mocks.appServerStatus,
}))

vi.mock("@/lib/ws-bridge", () => ({
  getWebSocketBridgeStatus: mocks.bridgeStatus,
}))

describe("/api/health", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    mocks.appServerStatus.mockReset()
    mocks.bridgeStatus.mockReset()
    mocks.appServerStatus.mockReturnValue({ status: "unknown", message: "App-server has not started yet." })
    mocks.bridgeStatus.mockReturnValue({ status: "ok", message: "WebSocket bridge is listening." })
  })

  it("returns structured service health when sandbox is reachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const { GET } = await import("./route")

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      services: {
        manifest: { status: "ok" },
        sandbox: { status: "ok" },
        bridge: { status: "ok" },
        appServer: { status: "unknown" },
      },
    })
  })

  it("maps refused sandbox connections to down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")))
    const { GET } = await import("./route")

    const response = await GET()

    await expect(response.json()).resolves.toMatchObject({
      services: {
        sandbox: {
          status: "down",
          message: "Sandbox is not reachable.",
        },
      },
    })
  })

  it("maps sandbox aborts to timeout", async () => {
    const abortError = new Error("aborted")
    abortError.name = "AbortError"
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError))
    const { GET } = await import("./route")

    const response = await GET()

    await expect(response.json()).resolves.toMatchObject({
      services: {
        sandbox: {
          status: "timeout",
          message: "Sandbox health check timed out.",
        },
      },
    })
  })
})
