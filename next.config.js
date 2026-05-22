/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/sandbox-preview/:path*", destination: "http://localhost:3001/:path*" },
      { source: "/_sandbox-images/:path*", destination: "http://localhost:3001/images/:path*" },
    ]
  },
}

module.exports = nextConfig
