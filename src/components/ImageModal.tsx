"use client"

import { useState } from "react"

type ImageModalProduct = {
  id: string
  name: string
}

type ImageModalProps = {
  product: ImageModalProduct
  open: boolean
  onClose: () => void
  sandboxWindow: Window | null
}

type GenerateResponse = {
  url?: string
  filename?: string
  error?: string
  flagged?: boolean
}

export function ImageModal({ product, open, onClose, sandboxWindow }: ImageModalProps) {
  const [context, setContext] = useState("")
  const [style, setStyle] = useState<"lifestyle" | "in-use">("lifestyle")
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function generateImage() {
    setGenerating(true)
    setError(null)
    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          context,
          style,
        }),
      })
      const payload = (await response.json()) as GenerateResponse
      if (!response.ok) throw new Error(payload.error ?? "Image generation failed")
      if (payload.url) setGeneratedUrl(payload.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed")
    } finally {
      setGenerating(false)
    }
  }

  function useImage() {
    if (!generatedUrl) return
    sandboxWindow?.postMessage({ type: "useImage", productId: product.id, url: generatedUrl }, "*")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 px-4 py-6">
      <section className="w-full max-w-4xl rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
        <header className="flex items-center justify-between border-b border-zinc-700 px-5 py-4">
          <h2 className="text-lg font-semibold">{product.name}</h2>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm text-zinc-400 transition hover:text-zinc-100">
            Close
          </button>
        </header>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-300">Base image</p>
            <div className="aspect-square overflow-hidden rounded-md bg-white">
              <img src={`/images/${product.id}-base.png`} alt={`Base ${product.name}`} className="h-full w-full object-cover" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-300">Generated image</p>
            <div className="grid aspect-square place-items-center overflow-hidden rounded-md border border-zinc-700 bg-zinc-950">
              {generatedUrl ? (
                <img
                  src={generatedUrl}
                  alt={`Generated ${product.name}`}
                  className="h-full w-full object-cover opacity-100 transition-opacity duration-300"
                />
              ) : (
                <p className="text-sm text-zinc-500">Generate to preview</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-zinc-700 p-5">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-300">Setting / mood</span>
            <input
              value={context}
              onChange={(event) => setContext(event.target.value)}
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500"
              placeholder="draped over a reading chair, afternoon light"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-md border border-zinc-700 bg-zinc-950 p-1">
              <button
                type="button"
                onClick={() => setStyle("lifestyle")}
                className={`h-8 rounded px-3 text-sm transition ${style === "lifestyle" ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
              >
                Lifestyle scene
              </button>
              <button
                type="button"
                onClick={() => setStyle("in-use")}
                className={`h-8 rounded px-3 text-sm transition ${style === "in-use" ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
              >
                In use
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={generateImage}
                disabled={generating}
                className="h-10 rounded-md bg-indigo-500 px-4 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate"}
              </button>
              <button
                type="button"
                onClick={useImage}
                disabled={!generatedUrl}
                className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-medium text-zinc-100 transition hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-50"
              >
                Use this image
              </button>
            </div>
          </div>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        </div>
      </section>
    </div>
  )
}
