import { createServer } from "node:http"
import { createRequire } from "node:module"
import path from "node:path"
import {
  createThreadStartMessage,
  createTurnStartMessage,
  getAppServerClient,
  startAppServer,
} from "./codex-server"
import { eventBus, type AppServerEvent } from "./event-bus"
import { checkModeration, ModerationError } from "./moderation"
import { createPersistenceState, persistAppServerEvent, persistFeatureRequest, type PersistenceState } from "./ws-persistence"
import { recordThreadEvent } from "./event-log"

process.env.WS_NO_BUFFER_UTIL = "1"
const require = createRequire(import.meta.url)
const { WebSocket, WebSocketServer } = require("ws") as typeof import("ws")
type WsSocket = InstanceType<typeof WebSocket>

type ClientMessage = {
  type?: string
  text?: string
}

export type BridgeState = {
  started: boolean
  listenStatus: "starting" | "listening" | "down"
  listenError: string | null
  currentThreadId: string | null
  pendingInputs: string[]
  pendingThreadTimer: ReturnType<typeof setTimeout> | null
  persistence: PersistenceState
}

const globalForBridge = globalThis as unknown as {
  manifestWsBridge?: BridgeState
}

export function ensureWebSocketBridge() {
  const existing = globalForBridge.manifestWsBridge
  if (existing?.started) return existing

  const state: BridgeState = {
    started: true,
    listenStatus: "starting",
    listenError: null,
    currentThreadId: null,
    pendingInputs: [],
    pendingThreadTimer: null,
    persistence: createPersistenceState(),
  }
  globalForBridge.manifestWsBridge = state

  const sandboxDir = path.join(process.cwd(), "sandbox")
  const server = createServer((_request, response) => {
    response.writeHead(426, { "content-type": "text/plain" })
    response.end("WebSocket upgrade required")
  })
  const wss = new WebSocketServer({ noServer: true })
  const clients = new Set<WsSocket>()

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/api/ws") {
      socket.destroy()
      return
    }
    wss.handleUpgrade(request, socket, head, (socketClient) => {
      wss.emit("connection", socketClient, request)
    })
  })

  wss.on("connection", (socket) => {
    clients.add(socket)
    startServerIfAvailable(sandboxDir)
    socket.on("message", (data) => {
      void handleClientMessage(socket, data.toString(), sandboxDir, state).catch((error) => {
        sendToClient(socket, {
          type: "bridge-error",
          error: error instanceof Error ? error.message : "Bridge failed while handling the request.",
        })
      })
    })
    socket.on("close", () => clients.delete(socket))
  })

  eventBus.on("app-server-event", (event) => {
    recordThreadEvent(event)
    void handleAppServerEvent(event, state, sandboxDir)
    const payload = JSON.stringify(event)
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    }
  })

  server.on("error", (error) => {
    state.listenStatus = "down"
    state.listenError = error instanceof Error ? error.message : "WebSocket bridge failed to listen."
    eventBus.emit("app-server-event", {
      type: "bridge-unavailable",
      error: state.listenError,
    })
  })
  server.listen(3002, "0.0.0.0", () => {
    state.listenStatus = "listening"
    state.listenError = null
  })
  return state
}

export function getWebSocketBridgeStatus() {
  const state = globalForBridge.manifestWsBridge
  if (!state) {
    return { status: "unknown" as const, message: "WebSocket bridge has not started yet." }
  }
  if (state.listenStatus === "listening") {
    return { status: "ok" as const, message: "WebSocket bridge is listening." }
  }
  if (state.listenStatus === "down") {
    return { status: "down" as const, message: state.listenError ?? "WebSocket bridge is unavailable." }
  }
  return { status: "unknown" as const, message: "WebSocket bridge is starting." }
}

export function resetWebSocketBridgeState() {
  const state = globalForBridge.manifestWsBridge
  if (!state) return

  state.currentThreadId = null
  state.pendingInputs = []
  if (state.pendingThreadTimer) clearTimeout(state.pendingThreadTimer)
  state.pendingThreadTimer = null
  state.persistence = createPersistenceState()
}

export async function handleClientMessage(socket: WsSocket, data: string, sandboxDir: string, state: BridgeState) {
  const message = parseClientMessage(data)
  if (!message?.text) return

  try {
    await checkModeration(message.text)
  } catch (error) {
    if (error instanceof ModerationError) {
      sendToClient(socket, { type: "moderation-blocked", error: "That prompt can't be used — please try different wording.", flagged: true })
      return
    }
    sendToClient(socket, {
      type: "bridge-error",
      error: error instanceof Error ? error.message : "Bridge failed while checking the request.",
    })
    return
  }

  const appServer = startServerIfAvailable(sandboxDir)
  if (!appServer) {
    clearPendingThreadStart(state)
    sendToClient(socket, { type: "app-server-unavailable", error: "App-server unavailable." })
    return
  }

  if (!state.currentThreadId) {
    state.pendingInputs.push(message.text)
    try {
      appServer.send(createThreadStartMessage())
      schedulePendingThreadTimeout(state)
    } catch {
      clearPendingThreadStart(state)
      sendToClient(socket, { type: "app-server-unavailable", error: "App-server unavailable." })
    }
    return
  }

  await persistFeatureRequest(state.persistence, message.text)
  try {
    appServer.send(createTurnStartMessage(state.currentThreadId, message.text, sandboxDir))
  } catch {
    sendToClient(socket, { type: "app-server-unavailable", error: "App-server unavailable." })
  }
}

function startServerIfAvailable(sandboxDir: string) {
  try {
    return getAppServerClient() ?? startAppServer(sandboxDir)
  } catch {
    return null
  }
}

async function handleAppServerEvent(event: AppServerEvent, state: BridgeState, sandboxDir: string) {
  const method = event.method ?? event.type
  const params = typeof event.params === "object" && event.params ? event.params : event
  const threadId = readString(params, "threadId") ?? readString(params, "id") ?? readNestedString(params, "thread", "id")

  await persistAppServerEvent(event, state.persistence, sandboxDir)

  if (method === "app-server-unavailable") {
    clearPendingThreadStart(state)
    return
  }

  if (method === "thread/started" && threadId) {
    if (state.pendingThreadTimer) clearTimeout(state.pendingThreadTimer)
    state.pendingThreadTimer = null
    state.currentThreadId = threadId
    state.persistence.currentThreadId = threadId
    const appServer = getAppServerClient()
    const nextInput = state.pendingInputs.shift()
    if (appServer && nextInput) {
      await persistFeatureRequest(state.persistence, nextInput)
      try {
        appServer.send(createTurnStartMessage(threadId, nextInput, sandboxDir))
      } catch {
        clearPendingThreadStart(state)
        eventBus.emit("app-server-event", { type: "app-server-unavailable", error: "App-server unavailable." })
      }
    }
  }
}

function schedulePendingThreadTimeout(state: BridgeState) {
  if (state.pendingThreadTimer) clearTimeout(state.pendingThreadTimer)
  state.pendingThreadTimer = setTimeout(() => {
    clearPendingThreadStart(state)
    eventBus.emit("app-server-event", {
      type: "bridge-request-timeout",
      error: "The request timed out before the agent started.",
    })
  }, 30_000)
}

function clearPendingThreadStart(state: BridgeState) {
  state.pendingInputs = []
  if (state.pendingThreadTimer) clearTimeout(state.pendingThreadTimer)
  state.pendingThreadTimer = null
}

function sendToClient(socket: WsSocket, event: AppServerEvent) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event))
  }
}

function parseClientMessage(data: string): ClientMessage | null {
  try {
    return JSON.parse(data) as ClientMessage
  } catch {
    return null
  }
}

function readString(source: object, key: string) {
  if (!(key in source)) return null
  const value = source[key as keyof typeof source]
  return typeof value === "string" ? value : null
}

function readNestedString(source: object, objectKey: string, valueKey: string) {
  if (!(objectKey in source)) return null
  const nested = source[objectKey as keyof typeof source]
  if (!nested || typeof nested !== "object") return null
  return readString(nested, valueKey)
}
