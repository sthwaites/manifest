import { execSync } from "child_process"
import path from "node:path"
import { auth } from "@/lib/auth"
import { restartAppServer } from "@/lib/codex-server"
import { prisma } from "@/lib/prisma"
import { requestSandboxRestart } from "@/lib/sandbox-runtime"
import { beginBridgeOperation, endBridgeOperation, resetWebSocketBridgeState } from "@/lib/ws-bridge"

function errorDetail(error: unknown) {
  return error instanceof Error ? error.message : "Unknown git error"
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sandboxDir = path.join(process.cwd(), "sandbox")
  const operation = beginBridgeOperation("reset")
  if (!operation.ok) {
    return Response.json({ error: "Sandbox is busy", operation: operation.operation }, { status: 409 })
  }

  try {
    // Reset restores the catalogue source and removes untracked files created during agent runs.
    execSync("git reset --hard baseline", { cwd: sandboxDir })
    execSync("git clean -fd", { cwd: sandboxDir })
    execSync("git clean -fdX public/images", { cwd: sandboxDir })
    await prisma.feature.updateMany({
      where: { status: { in: ["pending", "applied"] } },
      data: { status: "rolled_back" },
    })
    resetWebSocketBridgeState()
    restartAppServer(sandboxDir)
    await requestSandboxRestart(sandboxDir, { clearCache: true })
  } catch (error) {
    endBridgeOperation("reset")
    return Response.json({ error: "Reset failed", detail: errorDetail(error) }, { status: 500 })
  }

  return Response.json({ message: "Sandbox reset to baseline" })
}
