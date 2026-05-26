/** @type {import('next').NextConfig} */
const sandboxBasePath = process.env.NEXT_PUBLIC_SANDBOX_BASE_PATH || ""
const sandboxDistDir = process.env.SANDBOX_DIST_DIR || ""

const nextConfig = {
  outputFileTracingRoot: __dirname,
  ...(sandboxDistDir ? { distDir: sandboxDistDir } : {}),
  ...(sandboxBasePath ? { basePath: sandboxBasePath } : {}),
}

module.exports = nextConfig
