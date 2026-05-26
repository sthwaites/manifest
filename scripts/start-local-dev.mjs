import { spawn, spawnSync } from "node:child_process"

const children = new Set()
let shuttingDown = false

main()

function main() {
  run("npx", ["prisma", "generate"])
  run("npm", ["run", "sandbox:init"])

  spawnManaged("manifest", "npm", ["run", "dev"], {
    env: {
      ...process.env,
      DEBUG_AUTH: process.env.LOCAL_DEBUG_AUTH || "true",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "manifest-local-dev-secret",
      NEXT_PUBLIC_SANDBOX_PUBLIC_URL: process.env.NEXT_PUBLIC_SANDBOX_PUBLIC_URL || "http://localhost:3001",
      SANDBOX_INTERNAL_URL: process.env.SANDBOX_INTERNAL_URL || "http://localhost:3001",
    },
  })

  spawnManaged("sandbox", "sh", ["serve-dev.sh"], {
    cwd: "sandbox",
    env: {
      ...process.env,
      PORT: process.env.SANDBOX_PORT || "3001",
      BIND_HOST: process.env.SANDBOX_HOST || "0.0.0.0",
      SANDBOX_DIST_DIR: process.env.SANDBOX_DIST_DIR || `.next-${process.env.SANDBOX_PORT || "3001"}`,
      SANDBOX_NEXT_DEV_BUNDLER: process.env.SANDBOX_NEXT_DEV_BUNDLER || "default",
      SANDBOX_START_GRACE_SECONDS: process.env.SANDBOX_START_GRACE_SECONDS || "20",
      SANDBOX_HEALTH_INTERVAL_SECONDS: process.env.SANDBOX_HEALTH_INTERVAL_SECONDS || "10",
    },
  })
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function spawnManaged(name, command, args, options = {}) {
  const child = spawn(command, args, { stdio: "inherit", ...options })
  children.add(child)

  child.on("exit", (code, signal) => {
    children.delete(child)
    if (shuttingDown) return
    console.error(`${name} exited with ${signal || code}`)
    stopChildren()
    process.exit(code || 1)
  })
}

function stopChildren() {
  shuttingDown = true
  for (const child of children) {
    child.kill("SIGTERM")
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopChildren()
    process.exit(0)
  })
}
