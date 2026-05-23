import { execSync } from "child_process"
import path from "node:path"
import { auth } from "@/lib/auth"
import { restartAppServer } from "@/lib/codex-server"

function errorDetail(error: unknown) {
  return error instanceof Error ? error.message : "Unknown git error"
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sandboxDir = path.join(process.cwd(), "sandbox")
  try {
    // Reset restores the catalogue source and removes untracked files created during agent runs.
    execSync("git reset --hard baseline", { cwd: sandboxDir })
    execSync("git clean -fd", { cwd: sandboxDir })
    restartAppServer(sandboxDir)
  } catch (error) {
    return Response.json({ error: "Reset failed", detail: errorDetail(error) }, { status: 500 })
  }

  return Response.json({ message: "Sandbox reset to baseline" })
}
