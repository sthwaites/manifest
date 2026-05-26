import { execFileSync, spawnSync } from "node:child_process"

const project = process.env.SMOKE_COMPOSE_PROJECT || "manifest-smoke"
const env = {
  ...process.env,
  DOCKER_DEBUG_AUTH: "true",
  MANIFEST_PORT: process.env.MANIFEST_PORT || "3100",
  SANDBOX_PORT: process.env.SANDBOX_PORT || "3101",
  BRIDGE_PORT: process.env.BRIDGE_PORT || "3102",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3100",
  NEXT_PUBLIC_SANDBOX_PUBLIC_URL: process.env.NEXT_PUBLIC_SANDBOX_PUBLIC_URL || "http://localhost:3101",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "manifest-smoke-secret",
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: "inherit",
    env,
    ...options,
  })
}

function output(command, args) {
  return execFileSync(command, args, {
    env,
    encoding: "utf8",
  }).trim()
}

function compose(args) {
  return run("docker", ["compose", "-p", project, ...args])
}

function waitForHealth(url, timeoutMs = 120_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const result = spawnSync(
      "node",
      [
        "-e",
        "fetch(process.argv[1]).then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        url,
      ],
      { env, stdio: "ignore" },
    )
    if (result.status === 0) return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function killSandboxNextProcess() {
  const container = output("docker", ["compose", "-p", project, "ps", "-q", "app"])
  const script = `
    for p in /proc/[0-9]*; do
      c=$(tr '\\0' ' ' < "$p/cmdline" 2>/dev/null || true)
      case "$c" in
        *"next dev"*) kill "\${p#/proc/}"; exit 0 ;;
      esac
    done
    exit 1
  `
  run("docker", ["exec", container, "sh", "-lc", script])
}

try {
  const up = compose(["up", "--build", "-d"])
  if (up.status !== 0) process.exit(up.status ?? 1)

  waitForHealth(`http://localhost:${env.MANIFEST_PORT}/api/health`)
  waitForHealth(`http://localhost:${env.SANDBOX_PORT}/`)

  killSandboxNextProcess()
  waitForHealth(`http://localhost:${env.SANDBOX_PORT}/`)
  waitForHealth(`http://localhost:${env.MANIFEST_PORT}/api/health`)

  console.log("Docker smoke test passed.")
} finally {
  compose(["down", "-v"])
}
