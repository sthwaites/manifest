import { execSync } from "child_process"
import path from "node:path"
import { auth } from "@/lib/auth"
import { getAppServerClient } from "@/lib/codex-server"
import { prisma } from "@/lib/prisma"

type RollbackRequest = {
  threadId?: string
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as RollbackRequest
  const sandboxDir = path.join(process.cwd(), "sandbox")
  const appServer = getAppServerClient()

  if (body.threadId) {
    appServer?.send({
      method: "thread/rollback",
      id: Date.now(),
      params: { threadId: body.threadId },
    })
  }

  execSync("git reset --hard HEAD~1", { cwd: sandboxDir })

  if (body.threadId) {
    await prisma.feature.updateMany({
      where: { threadId: body.threadId, status: "applied" },
      data: { status: "rolled_back" },
    })
  }

  return Response.json({ message: "Rolled back to previous state" })
}
