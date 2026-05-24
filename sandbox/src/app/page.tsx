"use client"

import { ProductCard } from "../components/ProductCard"
import { products as seedProducts, type Product } from "../data/products"
import { useEffect, useState } from "react"

export default function SandboxHomePage() {
  const [products, setProducts] = useState<Product[]>(seedProducts)

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isUseImageMessage(event.data)) return
      setProducts((current) =>
        current.map((product) => (product.id === event.data.productId ? { ...product, image: event.data.url } : product)),
      )
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  function requestImage(product: Product) {
    window.parent.postMessage(
      {
        type: "generateImage",
        productId: product.id,
        productName: product.name,
      },
      "*",
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-normal">Manifest Catalogue</h1>
          <p className="max-w-2xl text-base text-zinc-600">Six products ready for Codex to reshape.</p>
        </header>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onGenerateImage={requestImage} />
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
