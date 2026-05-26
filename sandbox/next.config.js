/** @type {import('next').NextConfig} */
const sandboxDistDir = process.env.SANDBOX_DIST_DIR || ""

const nextConfig = {
  outputFileTracingRoot: __dirname,
  ...(sandboxDistDir ? { distDir: sandboxDistDir } : {}),
}

module.exports = nextConfig
