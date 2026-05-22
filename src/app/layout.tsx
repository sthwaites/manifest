import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Manifest",
  description: "A self-modifying product catalogue powered by Codex.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">{children}</body>
    </html>
  )
}
