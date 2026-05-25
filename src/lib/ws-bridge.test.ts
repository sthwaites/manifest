import { beforeEach, describe, expect, it, vi } from "vitest"

const codexServerMock = vi.hoisted(() => ({
  createThreadStartMessage: vi.fn(() => ({ method: "thread/start" })),
  createTurnStartMessage: vi.fn((threadId: string, input: string) => ({ method: "turn/start", params: { threadId, input } })),
  getAppServerClient: vi.fn(),
  startAppServer: vi.fn(),
}))

const persistenceMock = vi.hoisted(() => ({
  createPersistenceState: vi.fn(() => ({
    currentThreadId: null,
    activeFeatureId: null,
    fileChanges: [],
  })),
  persistAppServerEvent: vi.fn(),
  persistFeatureRequest: vi.fn(),
}))

vi.mock("./moderation", () => ({
  ModerationError: class ModerationError extends Error {},
  checkModeration: vi.fn(),
}))

vi.mock("./codex-server", () => codexServerMock)

vi.mock("./ws-persistence", () => persistenceMock)

type TestBridgeState = {
  started: boolean
  currentThreadId: string | null
  pendingInputs: string[]
  persistence: {
    currentThreadId: string | null
    activeFeatureId: string | null
    fileChanges: string[]
  }
}

const globalForBridge = globalThis as unknown as { manifestWsBridge?: TestBridgeState }

describe("ws bridge state reset", () => {
  beforeEach(() => {
    vi.resetModules()
    delete globalForBridge.manifestWsBridge
    codexServerMock.getAppServerClient.mockReset()
    codexServerMock.startAppServer.mockReset()
    codexServerMock.createThreadStartMessage.mockClear()
    codexServerMock.createTurnStartMessage.mockClear()
    persistenceMock.persistFeatureRequest.mockReset()
    persistenceMock.persistAppServerEvent.mockReset()
  })

  it("clears stale thread and persistence state after sandbox reset", async () => {
    globalForBridge.manifestWsBridge = {
      started: true,
      currentThreadId: "thread_stale",
      pendingInputs: ["queued prompt"],
      persistence: {
        currentThreadId: "thread_stale",
        activeFeatureId: "feature_stale",
        fileChanges: ["src/app/page.tsx\n+ stale"],
      },
    }

    const { resetWebSocketBridgeState } = await import("./ws-bridge")

    resetWebSocketBridgeState()

    expect(globalForBridge.manifestWsBridge).toMatchObject({
      started: true,
      currentThreadId: null,
      pendingInputs: [],
      persistence: {
        currentThreadId: null,
        activeFeatureId: null,
        fileChanges: [],
      },
    })
  })

  it("returns structured bridge errors for non-moderation failures", async () => {
    const { checkModeration } = await import("./moderation")
    vi.mocked(checkModeration).mockRejectedValueOnce(new Error("moderation service unavailable"))
    const { handleClientMessage } = await import("./ws-bridge")
    const socket = createSocket()

    await handleClientMessage(socket as never, JSON.stringify({ type: "featureRequest", text: "Add filters" }), "/tmp/sandbox", createState())

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      type: "bridge-error",
      error: "moderation service unavailable",
    }))
  })

  it("clears pending input and returns unavailable when app-server send fails", async () => {
    const { checkModeration } = await import("./moderation")
    vi.mocked(checkModeration).mockResolvedValueOnce(undefined)
    codexServerMock.startAppServer.mockReturnValueOnce({
      send: vi.fn(() => {
        throw new Error("stdin closed")
      }),
    })
    const { handleClientMessage } = await import("./ws-bridge")
    const state = createState()
    const socket = createSocket()

    await handleClientMessage(socket as never, JSON.stringify({ type: "featureRequest", text: "Add filters" }), "/tmp/sandbox", state)

    expect(state.pendingInputs).toEqual([])
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      type: "app-server-unavailable",
      error: "App-server unavailable.",
    }))
  })

  it("acknowledges an accepted turn so the UI can leave the sending state", async () => {
    const { checkModeration } = await import("./moderation")
    vi.mocked(checkModeration).mockResolvedValueOnce(undefined)
    const appServer = { send: vi.fn() }
    codexServerMock.startAppServer.mockReturnValueOnce(appServer)
    const { handleClientMessage } = await import("./ws-bridge")
    const state = createState()
    state.currentThreadId = "thread_1"
    state.persistence.currentThreadId = "thread_1"
    const socket = createSocket()

    await handleClientMessage(socket as never, JSON.stringify({ type: "featureRequest", text: "Add filters" }), "/tmp/sandbox", state)

    expect(appServer.send).toHaveBeenCalledWith(expect.objectContaining({ method: "turn/start" }))
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      type: "turn-started",
      message: "Agent accepted the request.",
      threadId: "thread_1",
    }))
  })
})

function createSocket() {
  return {
    readyState: 1,
    send: vi.fn(),
  }
}

function createState(): TestBridgeState & {
  listenStatus: "listening"
  listenError: null
  pendingThreadTimer: null
} {
  return {
    started: true,
    listenStatus: "listening" as const,
    listenError: null,
    currentThreadId: null,
    pendingInputs: [],
    pendingThreadTimer: null,
    persistence: {
      currentThreadId: null,
      activeFeatureId: null,
      fileChanges: [],
    },
  }
}
