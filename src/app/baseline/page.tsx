import Link from "next/link"

const previewProducts = [
  { id: "prod_001", name: "Coffee set" },
  { id: "prod_002", name: "Wool throw" },
  { id: "prod_003", name: "Desk organiser" },
  { id: "prod_004", name: "Cocktail shaker" },
]

export default function BaselinePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-md border border-indigo-400/30 bg-indigo-400/10 px-3 py-2 text-xs font-medium uppercase text-indigo-200">
            <span className="grid size-5 place-items-center rounded bg-indigo-400 text-[11px] font-bold text-zinc-950">M</span>
            Agent-assisted catalogue cockpit
          </div>
          <div className="max-w-3xl space-y-5">
            <h1 className="text-5xl font-semibold leading-tight tracking-normal text-white md:text-7xl">Manifest</h1>
            <p className="max-w-2xl text-xl leading-8 text-zinc-300">
              A live product catalogue workspace where feature requests, image generation, rollback, and reset all happen against an editable sandbox.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-md bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              Sign in to cockpit
            </Link>
            <span className="text-sm text-zinc-500">Local demo environment</span>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 shadow-2xl shadow-black/30">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <p className="text-xs uppercase text-zinc-500">Sandbox</p>
                <h2 className="text-lg font-semibold">Baseline catalogue</h2>
              </div>
              <span className="rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-300">Ready</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {previewProducts.map((product) => (
                <div key={product.id} className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
                  <div className="mb-3 aspect-square overflow-hidden rounded bg-zinc-800">
                    <img
                      src={`/_sandbox-images/${product.id}-base.png`}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="text-sm font-medium text-zinc-200">{product.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">Awaiting request</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-100">
              Codex edits this sandbox while you watch changes appear.
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
