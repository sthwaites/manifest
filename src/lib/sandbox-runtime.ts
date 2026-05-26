import { writeFile } from "node:fs/promises"
import path from "node:path"

export async function requestSandboxRestart(sandboxDir = path.join(process.cwd(), "sandbox")) {
  await writeFile(path.join(sandboxDir, ".manifest-restart"), `${Date.now()}\n`)
}
