import { ProductCard } from "../components/ProductCard"
import { products } from "../data/products"

export default function SandboxHomePage() {
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
