import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(__dirname, "..")
const sandboxDir = path.join(appDir, "sandbox")
const sandboxTemplateDir = path.join(appDir, "sandbox-template")
const persistRoot = process.env.PERSIST_ROOT
const runSandbox = process.env.RUN_SANDBOX_IN_CONTAINER === "true"
const runProxy = process.env.START_PROXY === "true"
const children = new Set()
const restartTimers = new Set()
let shuttingDown = false

main().catch((error) => {
  console.error(error)
  stopChildren()
  process.exit(1)
})

async function main() {
  if (persistRoot) {
    preparePersistedWorkspace(persistRoot)
  } else {
    hydrateMountedSandbox()
  }

  run("npx", ["prisma", "migrate", "deploy"], { cwd: appDir })
  run("npm", ["run", "sandbox:init"], { cwd: appDir })

  if (runSandbox) {
    const sandboxBasePath = process.env.SANDBOX_BASE_PATH || process.env.NEXT_PUBLIC_SANDBOX_BASE_PATH || ""
    spawnManaged("sandbox", "sh", ["serve-dev.sh"], {
      cwd: sandboxDir,
      env: {
        ...process.env,
        PORT: process.env.SANDBOX_PORT || "3001",
        BIND_HOST: "0.0.0.0",
        NODE_ENV: "development",
        SANDBOX_BASE_PATH: sandboxBasePath,
        NEXT_PUBLIC_SANDBOX_BASE_PATH: sandboxBasePath,
        SANDBOX_NEXT_DEV_BUNDLER: process.env.SANDBOX_NEXT_DEV_BUNDLER || "webpack",
      },
      restart: true,
      critical: false,
    })
  }

  spawnManaged("manifest", "npm", ["run", "start"], { cwd: appDir })

  if (runProxy) {
    spawnManaged("proxy", "node", ["scripts/proxy-server.mjs"], { cwd: appDir })
  }
}

function preparePersistedWorkspace(root) {
  const dataDir = path.join(root, "data")
  const persistedSandboxDir = path.join(root, "sandbox")

  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(persistedSandboxDir, { recursive: true })

  if (!fs.existsSync(path.join(persistedSandboxDir, "package.json"))) {
    copySandboxTemplate(persistedSandboxDir)
  }

  replaceWithSymlink(sandboxDir, persistedSandboxDir)
}

function hydrateMountedSandbox() {
  if (fs.existsSync(path.join(sandboxDir, "package.json"))) return
  copySandboxTemplate(sandboxDir)
}

function copySandboxTemplate(destination) {
  if (!fs.existsSync(path.join(sandboxTemplateDir, "package.json"))) {
    throw new Error(`Sandbox template is missing at ${sandboxTemplateDir}`)
  }

  fs.mkdirSync(destination, { recursive: true })
  fs.cpSync(sandboxTemplateDir, destination, {
    recursive: true,
    force: true,
    dereference: false,
  })
}

function replaceWithSymlink(linkPath, targetPath) {
  try {
    if (fs.lstatSync(linkPath).isSymbolicLink() && fs.readlinkSync(linkPath) === targetPath) {
      return
    }
  } catch {
    // The link path may not exist yet.
  }

  fs.rmSync(linkPath, { recursive: true, force: true })
  fs.symlinkSync(targetPath, linkPath, "dir")
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`)
  }
}

function spawnManaged(name, command, args, options = {}) {
  const { restart = false, critical = true, ...spawnOptions } = options
  const child = spawn(command, args, {
    stdio: "inherit",
    ...spawnOptions,
  })

  children.add(child)

  child.on("exit", (code, signal) => {
    children.delete(child)
    if (shuttingDown) return
    if (restart) {
      const delayMs = 2000
      console.error(`${name} exited with ${signal || code}; restarting in ${delayMs}ms`)
      const timer = setTimeout(() => {
        restartTimers.delete(timer)
        if (!shuttingDown) {
          spawnManaged(name, command, args, options)
        }
      }, delayMs)
      restartTimers.add(timer)
      return
    }
    console.error(`${name} exited with ${signal || code}`)
    if (critical) {
      stopChildren()
      process.exit(code || 1)
    }
  })
}

function stopChildren() {
  shuttingDown = true
  for (const timer of restartTimers) {
    clearTimeout(timer)
  }
  restartTimers.clear()
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
