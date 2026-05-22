import { PassThrough } from "node:stream"
import { EventEmitter } from "node:events"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ChildProcess } from "child_process"

const spawnMock = vi.hoisted(() => vi.fn())

vi.mock("child_process", () => ({
  default: { spawn: spawnMock },
  spawn: spawnMock,
}))

describe("codex-server", () => {
  beforeEach(() => {
    vi.resetModules()
    spawnMock.mockReset()
  })

  it("writes initialize and initialized messages on start", async () => {
    const child = createChildProcess()
    spawnMock.mockReturnValue(child)
    const { startAppServer } = await import("./codex-server")

    startAppServer("/tmp/sandbox")

    expect(child.stdinText()).toContain('"method":"initialize"')
    expect(child.stdinText()).toContain('"method":"initialized"')
  })

  it("parses JSONL stdout and emits events", async () => {
    const child = createChildProcess()
    spawnMock.mockReturnValue(child)
    const { eventBus } = await import("./event-bus")
    const { startAppServer } = await import("./codex-server")
    const received = new Promise((resolve) => eventBus.once("app-server-event", resolve))

    startAppServer("/tmp/sandbox")
    child.stdout.write('{"type":"agentMessage","message":"Done"}\n')

    await expect(received).resolves.toEqual({ type: "agentMessage", message: "Done" })
  })

  it("handles malformed JSONL without throwing", async () => {
    const child = createChildProcess()
    spawnMock.mockReturnValue(child)
    const { startAppServer } = await import("./codex-server")

    startAppServer("/tmp/sandbox")

    expect(() => child.stdout.write("not json\n")).not.toThrow()
  })
})

function createChildProcess() {
  const stdin = new WritableBuffer()
  const stdout = new PassThrough()
  const child = new EventEmitter() as ChildProcess & {
    stdin: WritableBuffer
    stdout: PassThrough
    stdinText: () => string
  }

  child.stdin = stdin
  child.stdout = stdout
  child.stderr = new PassThrough()
  child.kill = vi.fn(() => true) as ChildProcess["kill"]
  child.stdinText = () => stdin.text

  return child
}

class WritableBuffer extends PassThrough {
  text = ""

  override write(buffer: string | Uint8Array, callback?: (err?: Error | null) => void): boolean
  override write(buffer: string | Uint8Array, encoding?: BufferEncoding, callback?: (err?: Error | null) => void): boolean
  override write(
    buffer: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void,
  ) {
    this.text += Buffer.isBuffer(buffer) ? buffer.toString("utf8") : buffer.toString()
    return super.write(buffer, encodingOrCallback as BufferEncoding, callback)
  }
}
