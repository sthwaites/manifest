import { execSync } from "child_process"
import path from "node:path"
import { auth } from "@/lib/auth"
import { restartAppServer } from "@/lib/codex-server"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sandboxDir = path.join(process.cwd(), "sandbox")
  execSync("git reset --hard baseline", { cwd: sandboxDir })
  restartAppServer(sandboxDir)

  return Response.json({ message: "Sandbox reset to baseline" })
}
