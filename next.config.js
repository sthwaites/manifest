/** @type {import('next').NextConfig} */
const sandboxInternalUrl = process.env.SANDBOX_INTERNAL_URL ?? "http://localhost:3001"
const manifestDistDir = process.env.MANIFEST_DIST_DIR || ""

const nextConfig = {
  ...(manifestDistDir ? { distDir: manifestDistDir } : {}),
  env: {
    DEBUG_AUTH: process.env.DEBUG_AUTH ?? "false",
  },
  webpack(config, { dev }) {
    if (dev) {
      const existingIgnored = config.watchOptions?.ignored
      const ignoredGlobs = Array.isArray(existingIgnored)
        ? existingIgnored.filter((entry) => typeof entry === "string" && entry.length > 0)
        : typeof existingIgnored === "string" && existingIgnored.length > 0
          ? [existingIgnored]
          : []
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...ignoredGlobs,
          "**/.next-dev-*/**",
          "**/tmp/manifest-next-dev-*/**",
        ],
      }
    }
    return config
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
