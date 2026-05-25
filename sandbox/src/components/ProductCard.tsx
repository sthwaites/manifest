import type { Product } from "../data/products"
import { withSandboxBasePath } from "../lib/paths"

type ProductCardProps = {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="aspect-square bg-zinc-100">
        {product.image ? (
          <img src={withSandboxBasePath(product.image)} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-200 to-zinc-300 px-4 text-center text-sm font-medium text-zinc-600"
            data-testid="image-placeholder"
          >
            {product.name}
          </div>
        )}
      </div>
      <div className="space-y-3 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{product.category}</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">{product.name}</h2>
        </div>
        <p className="text-sm leading-6 text-zinc-600">{product.description}</p>
        <p className="text-xs text-zinc-500">{product.specs}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-semibold text-zinc-950">{product.currency} {product.price}</p>
        </div>
      </div>
    </article>
  )
}
