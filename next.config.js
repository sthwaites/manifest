/** @type {import('next').NextConfig} */
const sandboxInternalUrl = process.env.SANDBOX_INTERNAL_URL ?? "http://localhost:3001"

const nextConfig = {
  env: {
    DEBUG_AUTH: process.env.DEBUG_AUTH ?? "false",
  },
  async rewrites() {
    return [
      { source: "/sandbox-preview/:path*", destination: `${sandboxInternalUrl}/:path*` },
      { source: "/_sandbox-images/:path*", destination: `${sandboxInternalUrl}/images/:path*` },
      { source: "/images/:path*", destination: `${sandboxInternalUrl}/images/:path*` },
      { source: "/api/ws", destination: "http://localhost:3002/api/ws" },
    ]
  },
}

module.exports = nextConfig
