import { execSync } from "child_process"
import path from "node:path"
import { auth } from "@/lib/auth"
import { getAppServerClient } from "@/lib/codex-server"
import { prisma } from "@/lib/prisma"

type RollbackRequest = {
  threadId?: string
}

function gitOutput(command: string, cwd: string) {
  return execSync(command, { cwd, encoding: "utf8" }).trim()
}

function gitSucceeds(command: string, cwd: string) {
  try {
    execSync(command, { cwd })
    return true
  } catch {
    return false
  }
}

function errorDetail(error: unknown) {
  return error instanceof Error ? error.message : "Unknown git error"
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as RollbackRequest
  const sandboxDir = path.join(process.cwd(), "sandbox")
  let rolledBack = false

  try {
    const status = gitOutput("git status --porcelain", sandboxDir)

    // Codex can leave uncommitted file edits before a turn is committed; discard those before moving history.
    if (status.length > 0) {
      execSync("git reset --hard HEAD", { cwd: sandboxDir })
      rolledBack = true
    } else {
      const head = gitOutput("git rev-parse HEAD", sandboxDir)
      const baseline = gitOutput("git rev-parse baseline", sandboxDir)

      if (head !== baseline && gitSucceeds("git merge-base --is-ancestor baseline HEAD", sandboxDir)) {
        execSync("git reset --hard HEAD~1", { cwd: sandboxDir })
        rolledBack = true
      }
    }
  } catch (error) {
    return Response.json({ error: "Rollback failed", detail: errorDetail(error) }, { status: 500 })
  }

  if (body.threadId) {
    if (rolledBack) {
      const appServer = getAppServerClient()
      appServer?.send({
        method: "thread/rollback",
        id: Date.now(),
        params: { threadId: body.threadId },
      })
    }

    await prisma.feature.updateMany({
      where: { threadId: body.threadId, status: { in: ["pending", "applied"] } },
      data: { status: "rolled_back" },
    })
  }

  if (!rolledBack) {
    return Response.json({ message: "No sandbox changes to roll back" })
  }

  return Response.json({ message: "Rolled back to previous state" })
}
