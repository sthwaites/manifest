import Link from "next/link"
import { products } from "../../../sandbox/src/data/products"

export default function BaselinePage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-normal">Manifest - starting point</h1>
            <p className="max-w-2xl text-base text-zinc-600">
              Six products. Studio shots. No features. This is what we give Codex.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-indigo-500 px-4 text-sm font-medium text-white transition hover:bg-indigo-400"
          >
            Sign in to modify -&gt;
          </Link>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="aspect-square bg-zinc-100">
                <img
                  src={`/_sandbox-images/${product.id}-base.png`}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-3 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{product.category}</p>
                  <h2 className="mt-1 text-lg font-semibold">{product.name}</h2>
                </div>
                <p className="text-sm leading-6 text-zinc-600">{product.description}</p>
                <p className="text-xs text-zinc-500">{product.specs}</p>
                <p className="text-base font-semibold">GBP {product.price}</p>
              </div>
            </article>
          ))}
        </div>

        <footer className="border-t border-zinc-200 pt-6 text-sm text-zinc-500">
          Built with Codex in a 4-hour window.
        </footer>
      </section>
    </main>
  )
}
