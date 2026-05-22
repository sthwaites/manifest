import { ensureWebSocketBridge } from "@/lib/ws-bridge"

export const runtime = "nodejs"

export function GET() {
  ensureWebSocketBridge()
  return new Response("WebSocket bridge ready", {
    status: 426,
    headers: { "content-type": "text/plain" },
  })
}
