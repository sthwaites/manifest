import { beforeEach, describe, expect, it, vi } from "vitest";

const execSyncMock = vi.hoisted(() => vi.fn());
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
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("child_process", () => ({
  default: { execSync: execSyncMock },
  execSync: execSyncMock,
}));

describe("ws persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    execSyncMock.mockReset();
    prismaMock.user.upsert.mockReset();
    prismaMock.thread.upsert.mockReset();
    prismaMock.feature.create.mockReset();
    prismaMock.feature.update.mockReset();
  });

  it("persists a started thread for the debug user", async () => {
    const { createPersistenceState, persistAppServerEvent } =
      await import("./ws-persistence");
    const state = createPersistenceState();

    await persistAppServerEvent(
      { method: "thread/started", params: { thread: { id: "thread_1" } } },
      state,
      "/tmp/sandbox",
    );

    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "debug-user" } }),
    );
    expect(prismaMock.thread.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "thread_1" },
        create: expect.objectContaining({
          id: "thread_1",
          userId: "debug-user",
        }),
      }),
    );
  });

  it("creates a pending feature request for the active thread", async () => {
    prismaMock.feature.create.mockResolvedValue({ id: "feature_1" });
    const { createPersistenceState, persistFeatureRequest } =
      await import("./ws-persistence");
    const state = createPersistenceState();
    state.currentThreadId = "thread_1";

    await persistFeatureRequest(state, "Add filters");

    expect(prismaMock.feature.create).toHaveBeenCalledWith({
      data: { threadId: "thread_1", prompt: "Add filters", status: "pending" },
    });
    expect(state.activeFeatureId).toBe("feature_1");
  });

  it("updates the active feature with file diffs and commits sandbox changes on turn completion", async () => {
    const { createPersistenceState, persistAppServerEvent } =
      await import("./ws-persistence");
    const state = createPersistenceState();
    state.currentThreadId = "thread_1";
    state.activeFeatureId = "feature_1";

    await persistAppServerEvent(
      { type: "fileChange", path: "src/app/page.tsx", diff: "+ added search" },
      state,
      "/tmp/sandbox",
    );
    await persistAppServerEvent(
      {
        method: "turn/completed",
        params: { threadId: "thread_1", turn: { id: "turn_1" } },
      },
      state,
      "/tmp/sandbox",
    );

    expect(prismaMock.feature.update).toHaveBeenCalledWith({
      where: { id: "feature_1" },
      data: { diff: "src/app/page.tsx\n+ added search", status: "applied" },
    });
    expect(execSyncMock).toHaveBeenCalledWith(
      'git add -A && git commit -m "turn:turn_1 thread:thread_1"',
      expect.objectContaining({ cwd: "/tmp/sandbox" }),
    );
    expect(state.activeFeatureId).toBeNull();
  });

  it("uses the git diff when app-server does not emit fileChange events", async () => {
    execSyncMock.mockReturnValueOnce(
      "diff --git a/src/app/page.tsx b/src/app/page.tsx\n+ changed heading\n",
    );
    const { createPersistenceState, persistAppServerEvent } =
      await import("./ws-persistence");
    const state = createPersistenceState();
    state.currentThreadId = "thread_1";
    state.activeFeatureId = "feature_1";

    await persistAppServerEvent(
      {
        method: "turn/completed",
        params: { threadId: "thread_1", turn: { id: "turn_1" } },
      },
      state,
      "/tmp/sandbox",
    );

    expect(prismaMock.feature.update).toHaveBeenCalledWith({
      where: { id: "feature_1" },
      data: {
        diff: "diff --git a/src/app/page.tsx b/src/app/page.tsx\n+ changed heading",
        status: "applied",
      },
    });
    expect(execSyncMock).toHaveBeenCalledWith(
      "git diff -- .",
      expect.objectContaining({ cwd: "/tmp/sandbox", encoding: "utf8" }),
    );
    expect(execSyncMock).toHaveBeenCalledWith(
      'git add -A && git commit -m "turn:turn_1 thread:thread_1"',
      expect.objectContaining({ cwd: "/tmp/sandbox" }),
    );
  });

  it("marks failed turns without committing sandbox changes", async () => {
    const { createPersistenceState, persistAppServerEvent } =
      await import("./ws-persistence");
    const state = createPersistenceState();
    state.currentThreadId = "thread_1";
    state.activeFeatureId = "feature_1";

    await persistAppServerEvent(
      {
        method: "turn/completed",
        params: {
          threadId: "thread_1",
          turn: {
            id: "turn_1",
            status: "failed",
            error: { message: "authentication failed" },
          },
        },
      },
      state,
      "/tmp/sandbox",
    );

    expect(prismaMock.feature.update).toHaveBeenCalledWith({
      where: { id: "feature_1" },
      data: { diff: "authentication failed", status: "failed" },
    });
    expect(execSyncMock).not.toHaveBeenCalled();
    expect(state.activeFeatureId).toBeNull();
  });

  it("marks active features failed when the app-server becomes unavailable", async () => {
    const { createPersistenceState, persistAppServerEvent } =
      await import("./ws-persistence");
    const state = createPersistenceState();
    state.currentThreadId = "thread_1";
    state.activeFeatureId = "feature_1";
    state.fileChanges = ["src/app/page.tsx"];

    await persistAppServerEvent(
      {
        type: "app-server-unavailable",
        error: "App-server exited before the request finished.",
      },
      state,
      "/tmp/sandbox",
    );

    expect(prismaMock.feature.update).toHaveBeenCalledWith({
      where: { id: "feature_1" },
      data: {
        diff: "App-server exited before the request finished.",
        status: "failed",
      },
    });
    expect(state.activeFeatureId).toBeNull();
    expect(state.fileChanges).toEqual([]);
  });
});
