import { getAppServerStatus } from "@/lib/codex-server"
import { getWebSocketBridgeStatus } from "@/lib/ws-bridge"

export const runtime = "nodejs"

type HealthStatus = "ok" | "down" | "timeout" | "unknown"

type ServiceHealth = {
  status: HealthStatus
  message: string
}

const SANDBOX_TIMEOUT_MS = 1500

export async function GET() {
  const sandbox = await checkSandbox()
  return Response.json({
    services: {
      manifest: {
        status: "ok",
        message: "Manifest is serving requests.",
      },
      sandbox,
      bridge: getWebSocketBridgeStatus(),
      appServer: getAppServerStatus(),
    },
  })
}

async function checkSandbox(): Promise<ServiceHealth> {
  const url = process.env.SANDBOX_INTERNAL_URL ?? "http://localhost:3001"
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SANDBOX_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    })
    if (response.ok) {
      return { status: "ok", message: "Sandbox is reachable." }
    }
    return { status: "down", message: `Sandbox returned HTTP ${response.status}.` }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "timeout", message: "Sandbox health check timed out." }
    }
    return { status: "down", message: "Sandbox is not reachable." }
  } finally {
    clearTimeout(timeout)
  }
}
