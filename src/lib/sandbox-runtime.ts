import { writeFile } from "node:fs/promises"
import path from "node:path"

type SandboxRestartOptions = {
  clearCache?: boolean
}

export async function requestSandboxRestart(
  sandboxDir = path.join(process.cwd(), "sandbox"),
  options: SandboxRestartOptions = {},
) {
  if (options.clearCache) {
    await writeFile(path.join(sandboxDir, ".manifest-clear-cache"), `${Date.now()}\n`)
  }
  await writeFile(path.join(sandboxDir, ".manifest-restart"), `${Date.now()}\n`)
}
