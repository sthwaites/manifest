export function withSandboxBasePath(url: string) {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_SANDBOX_BASE_PATH)
  if (!basePath || !url.startsWith("/")) return url
  if (url === basePath || url.startsWith(`${basePath}/`)) return url
  return `${basePath}${url}`
}

function normalizeBasePath(value: string | undefined) {
  if (!value) return ""
  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed || trimmed === "/") return ""
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}
