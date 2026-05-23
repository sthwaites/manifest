import { spawn, type ChildProcessWithoutNullStreams } from "child_process"
import * as readline from "node:readline"
import { eventBus, type AppServerEvent } from "./event-bus"

export type AppServerClient = {
  send: (message: unknown) => void
  process: ChildProcessWithoutNullStreams
}

let proc: ChildProcessWithoutNullStreams | null = null
let client: AppServerClient | null = null
let nextMessageId = 1

export function startAppServer(sandboxDir: string): AppServerClient {
  if (client && proc && !proc.killed) {
    return client
  }

  try {
    proc = spawn("codex", ["app-server"], {
      cwd: sandboxDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        CODEX_API_KEY: process.env.CODEX_API_KEY,
      },
    })
  } catch (error) {
    emitUnavailable(error)
    throw error
  }

  const rl = readline.createInterface({ input: proc.stdout })
  rl.on("line", (line) => {
    try {
      const message = JSON.parse(line) as AppServerEvent
      // Bridge raw App Server events to WebSocket subscribers without coupling UI code to stdio.
      eventBus.emit("app-server-event", message)
    } catch {
      eventBus.emit("debug-event", { type: "malformed-app-server-event", line })
    }
  })

  proc.on("error", emitUnavailable)
  proc.on("exit", (code, signal) => {
    eventBus.emit("debug-event", { type: "app-server-exit", code, signal })
    proc = null
    client = null
  })

  client = {
    process: proc,
    send(message: unknown) {
      if (!proc || proc.killed) {
        eventBus.emit("app-server-event", { type: "app-server-unavailable" })
        return
      }
      proc.stdin.write(`${JSON.stringify(message)}\n`)
    },
  }

  initializeAppServer(client)
  return client
}

export function restartAppServer(sandboxDir: string): AppServerClient {
  if (proc && !proc.killed) {
    proc.kill()
  }
  proc = null
  client = null
  return startAppServer(sandboxDir)
}

export function getAppServerClient() {
  return client
}

export function createThreadStartMessage() {
  return {
    method: "thread/start",
    id: nextMessageId++,
    params: {
      model: "gpt-5.5",
      ephemeral: false,
    },
  }
}

export function createTurnStartMessage(threadId: string, input: string, sandboxDir: string) {
  return {
    method: "turn/start",
    id: nextMessageId++,
    params: {
      threadId,
      input: [{ type: "text", text: input }],
      sandboxPolicy: {
        type: "workspaceWrite",
        writableRoots: [sandboxDir],
      },
    },
  }
}

function initializeAppServer(appServerClient: AppServerClient) {
  appServerClient.send({
    method: "initialize",
    id: nextMessageId++,
    params: {
      clientInfo: {
        name: "manifest",
        version: "0.1.0",
      },
      capabilities: {
        optOutNotificationMethods: [],
      },
    },
  })
  appServerClient.send({
    method: "initialized",
    params: {},
  })
}

function emitUnavailable(error?: unknown) {
  eventBus.emit("app-server-event", {
    type: "app-server-unavailable",
    message: error instanceof Error ? error.message : "App Server not running",
  })
}
