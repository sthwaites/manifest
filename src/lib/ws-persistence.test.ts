import { beforeEach, describe, expect, it, vi } from "vitest"

const execSyncMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  user: {
    upsert: vi.fn(),
  },
  thread: {
    upsert: vi.fn(),
  },
  feature: {
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("child_process", () => ({
  default: { execSync: execSyncMock },
  execSync: execSyncMock,
}))

describe("ws persistence", () => {
  beforeEach(() => {
    vi.resetModules()
    execSyncMock.mockReset()
    prismaMock.user.upsert.mockReset()
    prismaMock.thread.upsert.mockReset()
    prismaMock.feature.create.mockReset()
    prismaMock.feature.update.mockReset()
  })

  it("persists a started thread for the debug user", async () => {
    const { createPersistenceState, persistAppServerEvent } = await import("./ws-persistence")
    const state = createPersistenceState()

    await persistAppServerEvent(
      { method: "thread/started", params: { thread: { id: "thread_1" } } },
      state,
      "/tmp/sandbox",
    )

    expect(prismaMock.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "debug-user" } }))
    expect(prismaMock.thread.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "thread_1" },
        create: expect.objectContaining({ id: "thread_1", userId: "debug-user" }),
      }),
    )
  })

  it("creates a pending feature request for the active thread", async () => {
    prismaMock.feature.create.mockResolvedValue({ id: "feature_1" })
    const { createPersistenceState, persistFeatureRequest } = await import("./ws-persistence")
    const state = createPersistenceState()
    state.currentThreadId = "thread_1"

    await persistFeatureRequest(state, "Add filters")

    expect(prismaMock.feature.create).toHaveBeenCalledWith({
      data: { threadId: "thread_1", prompt: "Add filters", status: "pending" },
    })
    expect(state.activeFeatureId).toBe("feature_1")
  })

  it("updates the active feature with file diffs and commits sandbox changes on turn completion", async () => {
    const { createPersistenceState, persistAppServerEvent } = await import("./ws-persistence")
    const state = createPersistenceState()
    state.currentThreadId = "thread_1"
    state.activeFeatureId = "feature_1"

    await persistAppServerEvent(
      { type: "fileChange", path: "src/app/page.tsx", diff: "+ added search" },
      state,
      "/tmp/sandbox",
    )
    await persistAppServerEvent(
      { method: "turn/completed", params: { threadId: "thread_1", turn: { id: "turn_1" } } },
      state,
      "/tmp/sandbox",
    )

    expect(prismaMock.feature.update).toHaveBeenCalledWith({
      where: { id: "feature_1" },
      data: { diff: "src/app/page.tsx\n+ added search", status: "applied" },
    })
    expect(execSyncMock).toHaveBeenCalledWith(
      "git add -A && git commit -m \"turn:turn_1 thread:thread_1\"",
      expect.objectContaining({ cwd: "/tmp/sandbox" }),
    )
    expect(state.activeFeatureId).toBeNull()
  })
})
