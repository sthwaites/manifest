const manifestUrl = process.env.MANIFEST_SMOKE_URL || "http://localhost:3000/api/health"
const sandboxUrl = process.env.SANDBOX_SMOKE_URL || "http://localhost:3001/"
const timeoutMs = Number(process.env.LOCAL_SMOKE_TIMEOUT_MS || 30_000)

await check("manifest", manifestUrl)
await check("sandbox", sandboxUrl)
console.log("Local smoke test passed.")

async function check(name, url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`${name} returned HTTP ${response.status}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}
