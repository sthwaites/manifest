"use client"

import { ProductCard } from "../components/ProductCard"
import { products as seedProducts, type Product } from "../data/products"
import { withSandboxBasePath } from "../lib/paths"
import { useEffect, useState } from "react"

const IMAGE_OVERRIDES_URL = withSandboxBasePath("/image-overrides.json")
const IMAGE_OVERRIDES_POLL_MS = 2000

export default function SandboxHomePage() {
  const [products, setProducts] = useState<Product[]>(seedProducts)

  useEffect(() => {
    let active = true

    function handleMessage(event: MessageEvent) {
      if (!isUseImageMessage(event.data)) return
      setProducts((current) =>
        current.map((product) => (product.id === event.data.productId ? { ...product, image: event.data.url } : product)),
      )
    }

    async function loadImageOverrides() {
      const overrides = await fetchImageOverrides()
      if (!active || !overrides) return
      setProducts(applyImageOverrides(seedProducts, overrides))
    }

    window.addEventListener("message", handleMessage)
    void loadImageOverrides()
    const intervalId = window.setInterval(() => void loadImageOverrides(), IMAGE_OVERRIDES_POLL_MS)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener("message", handleMessage)
    }
  }, [])

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-normal">Manifest Catalogue</h1>
          <p className="max-w-2xl text-base text-zinc-600">Six products ready for Codex to reshape.</p>
        </header>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </main>
  )
}

function isUseImageMessage(data: unknown): data is { type: "useImage"; productId: string; url: string } {
  if (!data || typeof data !== "object") return false
  const message = data as { type?: unknown; productId?: unknown; url?: unknown }
  return message.type === "useImage" && typeof message.productId === "string" && typeof message.url === "string"
}

async function fetchImageOverrides() {
  try {
    const response = await fetch(`${IMAGE_OVERRIDES_URL}?t=${Date.now()}`, { cache: "no-store" })
    if (response.status === 404) return {}
    if (!response.ok) return null
    const payload = (await response.json()) as unknown
    return isImageOverrides(payload) ? payload : null
  } catch {
    return null
  }
}

function isImageOverrides(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.values(value).every((entry) => typeof entry === "string" && entry.startsWith("/images/")),
  )
}

function applyImageOverrides(products: Product[], overrides: Record<string, string>) {
  return products.map((product) => ({
    ...product,
    image: overrides[product.id] ?? product.image,
  }))
}
