import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProcess } from "child_process";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  default: { spawn: spawnMock },
  spawn: spawnMock,
}));

describe("codex-server", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalCodexKey = process.env.CODEX_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    spawnMock.mockReset();
    delete process.env.OPENAI_API_KEY;
    delete process.env.CODEX_API_KEY;
  });

  afterEach(() => {
    if (originalOpenAiKey) process.env.OPENAI_API_KEY = originalOpenAiKey;
    else delete process.env.OPENAI_API_KEY;
    if (originalCodexKey) process.env.CODEX_API_KEY = originalCodexKey;
    else delete process.env.CODEX_API_KEY;
  });

  it("writes initialize and initialized messages on start", async () => {
    const child = createChildProcess();
    spawnMock.mockReturnValue(child);
    const { startAppServer } = await import("./codex-server");

    startAppServer("/tmp/sandbox");

    expect(child.stdinText()).toContain('"method":"initialize"');
    expect(child.stdinText()).toContain('"method":"initialized"');
  });

  it("logs the app-server into API key auth when a key is configured", async () => {
    process.env.CODEX_API_KEY = "sk-proj-test";
    const child = createChildProcess();
    spawnMock.mockReturnValue(child);
    const { startAppServer } = await import("./codex-server");

    startAppServer("/tmp/sandbox");

    expect(child.stdinText()).toContain('"method":"account/login/start"');
    expect(child.stdinText()).toContain('"type":"apiKey"');
    expect(child.stdinText()).toContain('"apiKey":"sk-proj-test"');
  });

  it("creates non-interactive Docker-safe turns", async () => {
    const { createTurnStartMessage } = await import("./codex-server");

    expect(
      createTurnStartMessage("thread_1", "Add filters", "/tmp/sandbox"),
    ).toMatchObject({
      method: "turn/start",
      params: {
        threadId: "thread_1",
        approvalPolicy: "never",
        cwd: "/tmp/sandbox",
        sandboxPolicy: {
          type: "dangerFullAccess",
        },
      },
    });
  });

  it("starts app-server with a git commit identity", async () => {
    const child = createChildProcess();
    spawnMock.mockReturnValue(child);
    const { startAppServer } = await import("./codex-server");

    startAppServer("/tmp/sandbox");

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      [
        "app-server",
        "-c",
        'approval_policy="never"',
        "-c",
        'sandbox_mode="danger-full-access"',
      ],
      expect.objectContaining({
        env: expect.objectContaining({
          GIT_AUTHOR_NAME: "Manifest Agent",
          GIT_AUTHOR_EMAIL: "manifest-agent@example.invalid",
          GIT_COMMITTER_NAME: "Manifest Agent",
          GIT_COMMITTER_EMAIL: "manifest-agent@example.invalid",
        }),
      }),
    );
  });

  it("parses JSONL stdout and emits events", async () => {
    const child = createChildProcess();
    spawnMock.mockReturnValue(child);
    const { eventBus } = await import("./event-bus");
    const { startAppServer } = await import("./codex-server");
    const received = new Promise((resolve) =>
      eventBus.once("app-server-event", resolve),
    );

    startAppServer("/tmp/sandbox");
    child.stdout.write('{"type":"agentMessage","message":"Done"}\n');

    await expect(received).resolves.toEqual({
      type: "agentMessage",
      message: "Done",
    });
  });

  it("handles malformed JSONL without throwing", async () => {
    const child = createChildProcess();
    spawnMock.mockReturnValue(child);
    const { startAppServer } = await import("./codex-server");

    startAppServer("/tmp/sandbox");

    expect(() => child.stdout.write("not json\n")).not.toThrow();
  });

  it("emits unavailable when the app-server exits", async () => {
    const child = createChildProcess();
    spawnMock.mockReturnValue(child);
    const { eventBus } = await import("./event-bus");
    const { startAppServer } = await import("./codex-server");
    const received = new Promise((resolve) =>
      eventBus.once("app-server-event", resolve),
    );

    startAppServer("/tmp/sandbox");
    child.emit("exit", 1, null);

    await expect(received).resolves.toMatchObject({
      type: "app-server-unavailable",
      error: "App-server exited before the request finished.",
      code: 1,
    });
  });

  it("emits unavailable when stdin writes fail", async () => {
    const child = createChildProcess();
    child.stdin.write = vi.fn(() => {
      throw new Error("stdin closed");
    }) as unknown as WritableBuffer["write"];
    spawnMock.mockReturnValue(child);
    const { eventBus } = await import("./event-bus");
    const { startAppServer } = await import("./codex-server");
    const received = new Promise((resolve) =>
      eventBus.once("app-server-event", resolve),
    );

    startAppServer("/tmp/sandbox");

    await expect(received).resolves.toMatchObject({
      type: "app-server-unavailable",
      error: "stdin closed",
    });
  });
});

function createChildProcess() {
  const stdin = new WritableBuffer();
  const stdout = new PassThrough();
  const child = new EventEmitter() as ChildProcess & {
    stdin: WritableBuffer;
    stdout: PassThrough;
    stdinText: () => string;
  };

  child.stdin = stdin;
  child.stdout = stdout;
  child.stderr = new PassThrough();
  child.kill = vi.fn(() => true) as ChildProcess["kill"];
  child.stdinText = () => stdin.text;

  return child;
}

class WritableBuffer extends PassThrough {
  text = "";

  override write(
    buffer: string | Uint8Array,
    callback?: (err?: Error | null) => void,
  ): boolean;
  override write(
    buffer: string | Uint8Array,
    encoding?: BufferEncoding,
    callback?: (err?: Error | null) => void,
  ): boolean;
  override write(
    buffer: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void,
  ) {
    this.text += Buffer.isBuffer(buffer)
      ? buffer.toString("utf8")
      : buffer.toString();
    return super.write(buffer, encodingOrCallback as BufferEncoding, callback);
  }
}
