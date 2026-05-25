import http from "node:http"
import net from "node:net"

const listenPort = Number(process.env.PORT || process.env.PROXY_PORT || 8080)
const manifestPort = Number(process.env.MANIFEST_PORT || 3000)
const sandboxPort = Number(process.env.SANDBOX_PORT || 3001)
const bridgePort = Number(process.env.BRIDGE_PORT || 3002)
const sandboxBasePath = normalizeBasePath(process.env.SANDBOX_BASE_PATH || "/sandbox")

const server = http.createServer((req, res) => {
  const target = getTarget(req.url || "/")
  proxyHttp(req, res, target)
})

server.on("upgrade", (req, socket, head) => {
  const target = getTarget(req.url || "/")
  proxyUpgrade(req, socket, head, target)
})

server.listen(listenPort, "0.0.0.0", () => {
  console.log(`Manifest proxy listening on 0.0.0.0:${listenPort}`)
})

function getTarget(url) {
  const pathname = safePathname(url)

  if (pathname === "/api/ws") {
    return { port: bridgePort, name: "bridge" }
  }

  if (pathname.startsWith("/images/")) {
    return { port: sandboxPort, name: "sandbox", path: withSandboxBasePath(reqPath(url)) }
  }

  if (pathname.startsWith("/_sandbox-images/")) {
    return { port: sandboxPort, name: "sandbox", path: withSandboxBasePath(reqPath(url).replace(/^\/_sandbox-images/, "/images")) }
  }

  if (pathname.startsWith("/sandbox-preview/")) {
    return { port: sandboxPort, name: "sandbox", path: withSandboxBasePath(reqPath(url).replace(/^\/sandbox-preview/, "")) }
  }

  if (isSandboxPath(pathname)) {
    return { port: sandboxPort, name: "sandbox" }
  }

  return { port: manifestPort, name: "manifest" }
}

function proxyHttp(req, res, target) {
  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: target.port,
      method: req.method,
      path: target.path || req.url,
      headers: proxyHeaders(req, target.port),
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
      proxyRes.pipe(res)
    },
  )

  proxyReq.on("error", (error) => {
    console.error(`Proxy could not reach ${target.name} on port ${target.port}:`, error.message)
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" })
    }
    res.end(`${target.name} is unavailable.`)
  })

  req.pipe(proxyReq)
}

function proxyUpgrade(req, socket, head, target) {
  const upstream = net.connect(target.port, "127.0.0.1")

  upstream.on("connect", () => {
    upstream.write(formatUpgradeRequest(req, target))
    if (head.length > 0) {
      upstream.write(head)
    }
    socket.pipe(upstream).pipe(socket)
  })

  upstream.on("error", (error) => {
    console.error(`Proxy upgrade could not reach ${target.name} on port ${target.port}:`, error.message)
    socket.destroy()
  })
}

function proxyHeaders(req, port) {
  return {
    ...req.headers,
    host: `127.0.0.1:${port}`,
    "x-forwarded-host": req.headers.host,
    "x-forwarded-proto": req.headers["fly-forwarded-proto"] || "https",
    "x-forwarded-for": appendForwardedFor(req),
  }
}

function formatUpgradeRequest(req, target) {
  const headers = proxyHeaders(req, target.port)
  const lines = [`${req.method} ${target.path || req.url} HTTP/${req.httpVersion}`]

  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        lines.push(`${name}: ${entry}`)
      }
    } else if (value !== undefined) {
      lines.push(`${name}: ${value}`)
    }
  }

  return `${lines.join("\r\n")}\r\n\r\n`
}

function appendForwardedFor(req) {
  const current = req.headers["x-forwarded-for"]
  const remote = req.socket.remoteAddress
  if (!remote) return current
  return current ? `${current}, ${remote}` : remote
}

function isSandboxPath(pathname) {
  return pathname === sandboxBasePath || pathname.startsWith(`${sandboxBasePath}/`)
}

function safePathname(url) {
  try {
    return new URL(url, "http://localhost").pathname
  } catch {
    return "/"
  }
}

function reqPath(url) {
  try {
    const parsed = new URL(url, "http://localhost")
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

function withSandboxBasePath(path) {
  if (path === sandboxBasePath || path.startsWith(`${sandboxBasePath}/`)) return path
  return `${sandboxBasePath}${path.startsWith("/") ? path : `/${path}`}`
}

function normalizeBasePath(value) {
  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed || trimmed === "/") return "/sandbox"
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}
