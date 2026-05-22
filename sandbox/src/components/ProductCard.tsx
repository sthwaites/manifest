import type { Product } from "../data/products"

type ProductCardProps = {
  product: Product
  onGenerateImage?: (product: Product) => void
}

export function ProductCard({ product, onGenerateImage }: ProductCardProps) {
  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="aspect-square bg-zinc-100">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500" data-testid="image-placeholder">
            Image coming soon
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
          {onGenerateImage ? (
            <button
              type="button"
              aria-label={`Generate image for ${product.name}`}
              onClick={() => onGenerateImage(product)}
              className="h-8 rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-700 transition hover:border-indigo-500 hover:text-indigo-600"
            >
              Generate image
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
