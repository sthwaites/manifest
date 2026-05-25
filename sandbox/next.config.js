/** @type {import('next').NextConfig} */
const sandboxBasePath = process.env.NEXT_PUBLIC_SANDBOX_BASE_PATH || ""

const nextConfig = {
  outputFileTracingRoot: __dirname,
  ...(sandboxBasePath ? { basePath: sandboxBasePath } : {}),
}

module.exports = nextConfig
