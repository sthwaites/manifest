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

process.env.WS_NO_BUFFER_UTIL = "1"
const require = createRequire(import.meta.url)
const { WebSocket, WebSocketServer } = require("ws") as typeof import("ws")
type WsSocket = InstanceType<typeof WebSocket>

type ClientMessage = {
  type?: string
  text?: string
}

type BridgeState = {
  started: boolean
  currentThreadId: string | null
  pendingInputs: string[]
}

const globalForBridge = globalThis as unknown as {
  manifestWsBridge?: BridgeState
}

export function ensureWebSocketBridge() {
  const existing = globalForBridge.manifestWsBridge
  if (existing?.started) return existing

  const state: BridgeState = {
    started: true,
    currentThreadId: null,
    pendingInputs: [],
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
      void handleClientMessage(socket, data.toString(), sandboxDir, state)
    })
    socket.on("close", () => clients.delete(socket))
  })

  eventBus.on("app-server-event", (event) => {
    trackThread(event, state, sandboxDir)
    const payload = JSON.stringify(event)
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    }
  })

  server.listen(3002, "127.0.0.1")
  return state
}

async function handleClientMessage(socket: WsSocket, data: string, sandboxDir: string, state: BridgeState) {
  const message = parseClientMessage(data)
  if (!message?.text) return

  try {
    await checkModeration(message.text)
  } catch (error) {
    if (error instanceof ModerationError) {
      socket.send(JSON.stringify({ error: "That prompt can't be used - please try different wording.", flagged: true }))
      return
    }
    throw error
  }

  const appServer = startServerIfAvailable(sandboxDir)
  if (!appServer) {
    socket.send(JSON.stringify({ type: "app-server-unavailable", error: "App Server not running" }))
    return
  }

  if (!state.currentThreadId) {
    state.pendingInputs.push(message.text)
    appServer.send(createThreadStartMessage())
    return
  }

  appServer.send(createTurnStartMessage(state.currentThreadId, message.text, sandboxDir))
}

function startServerIfAvailable(sandboxDir: string) {
  try {
    return getAppServerClient() ?? startAppServer(sandboxDir)
  } catch {
    return null
  }
}

function trackThread(event: AppServerEvent, state: BridgeState, sandboxDir: string) {
  const method = event.method ?? event.type
  const params = typeof event.params === "object" && event.params ? event.params : event
  const threadId = readString(params, "threadId") ?? readString(params, "id") ?? readNestedString(params, "thread", "id")

  if (method === "thread/started" && threadId) {
    state.currentThreadId = threadId
    const appServer = getAppServerClient()
    const nextInput = state.pendingInputs.shift()
    if (appServer && nextInput) {
      appServer.send(createTurnStartMessage(threadId, nextInput, sandboxDir))
    }
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
