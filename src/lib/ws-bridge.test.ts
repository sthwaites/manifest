import { beforeEach, describe, expect, it, vi } from "vitest"

const codexServerMock = vi.hoisted(() => ({
  createThreadStartMessage: vi.fn(() => ({ method: "thread/start" })),
  createTurnStartMessage: vi.fn((threadId: string, input: string) => ({ method: "turn/start", params: { threadId, input } })),
  getAppServerClient: vi.fn(),
  startAppServer: vi.fn(),
}))

const execSyncMock = vi.hoisted(() => vi.fn())

const persistenceMock = vi.hoisted(() => ({
  createPersistenceState: vi.fn(() => ({
    currentThreadId: null,
    activeFeatureId: null,
    fileChanges: [],
  })),
  persistAppServerEvent: vi.fn(),
  persistFeatureRequest: vi.fn(),
  setPersistenceUser: vi.fn((state, user) => {
    state.user = user
  }),
  findPersistenceUserBySessionToken: vi.fn(),
}))

vi.mock("./moderation", () => ({
  ModerationError: class ModerationError extends Error {},
  checkModeration: vi.fn(),
}))

vi.mock("./codex-server", () => codexServerMock)

vi.mock("./ws-persistence", () => persistenceMock)

vi.mock("node:child_process", () => ({
  default: { execSync: execSyncMock },
  execSync: execSyncMock,
}))

type TestBridgeState = {
  started: boolean
  currentThreadId: string | null
  pendingInputs: string[]
  persistence: {
    currentThreadId: string | null
    activeFeatureId: string | null
    fileChanges: string[]
    user: { id: string; email: string; name: string }
  }
  activeOperation: "feature" | "rollback" | "reset" | "image" | null
  activeRequestTimer: ReturnType<typeof setTimeout> | null
  syntheticCompletionTimer: ReturnType<typeof setTimeout> | null
  activeAppServerGeneration: number | null
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
    execSyncMock.mockReset()
    vi.useRealTimers()
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
        user: { id: "debug-user", email: "dev@localhost", name: "Dev User" },
      },
      activeOperation: "feature",
      activeRequestTimer: null,
      syntheticCompletionTimer: null,
      activeAppServerGeneration: 1,
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

  it("rejects a feature request while another sandbox operation is active", async () => {
    const { handleClientMessage } = await import("./ws-bridge")
    const state = createState()
    state.activeOperation = "reset"
    const socket = createSocket()

    await handleClientMessage(socket as never, JSON.stringify({ type: "featureRequest", text: "Add filters" }), "/tmp/sandbox", state)

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      type: "bridge-busy",
      error: "Another sandbox operation is still running. Wait for it to finish, then send again.",
      operation: "reset",
    }))
    expect(codexServerMock.startAppServer).not.toHaveBeenCalled()
  })

  it("synthesizes completion when the watchdog sees sandbox changes", async () => {
    vi.useFakeTimers()
    const { checkModeration } = await import("./moderation")
    vi.mocked(checkModeration).mockResolvedValueOnce(undefined)
    execSyncMock.mockReturnValue(" M src/app/page.tsx\n")
    const appServer = { send: vi.fn(() => true), generation: 1 }
    codexServerMock.startAppServer.mockReturnValueOnce(appServer)
    const { eventBus } = await import("./event-bus")
    const { handleClientMessage } = await import("./ws-bridge")
    const state = createState()
    state.currentThreadId = "thread_1"
    state.persistence.currentThreadId = "thread_1"
    const socket = createSocket()
    const received = new Promise((resolve) => eventBus.once("app-server-event", resolve))

    await handleClientMessage(socket as never, JSON.stringify({ type: "featureRequest", text: "Add filters" }), "/tmp/sandbox", state)
    state.persistence.activeFeatureId = "feature_1"
    vi.advanceTimersByTime(120_000)

    await expect(received).resolves.toMatchObject({
      method: "turn/completed",
      warning: "The agent stopped reporting progress after changing files; saved the visible sandbox changes.",
    })
  })

  it("synthesizes completion soon after file changes settle", async () => {
    vi.useFakeTimers()
    execSyncMock.mockReturnValue(" M src/app/page.tsx\n")
    const { eventBus } = await import("./event-bus")
    const { handleAppServerEvent } = await import("./ws-bridge")
    const state = createState()
    state.currentThreadId = "thread_1"
    state.activeOperation = "feature"
    state.persistence.currentThreadId = "thread_1"
    state.persistence.activeFeatureId = "feature_1"
    const received = new Promise((resolve) => eventBus.once("app-server-event", resolve))

    await handleAppServerEvent({ type: "fileChange", path: "src/app/page.tsx" }, state, "/tmp/sandbox")
    vi.advanceTimersByTime(4_000)

    await expect(received).resolves.toMatchObject({
      method: "turn/completed",
      warning: "Sandbox changes were applied; marked the request complete after file activity settled.",
    })
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
    activeOperation: null,
    activeRequestTimer: null,
    syntheticCompletionTimer: null,
    activeAppServerGeneration: null,
    persistence: {
      currentThreadId: null,
      activeFeatureId: null,
      fileChanges: [],
      user: { id: "debug-user", email: "dev@localhost", name: "Dev User" },
    },
  }
}
