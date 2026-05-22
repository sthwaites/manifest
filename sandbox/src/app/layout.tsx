import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Manifest Sandbox",
  description: "Product catalogue sandbox.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
