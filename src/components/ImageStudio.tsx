"use client"

import { ImagePlus, Mic, WandSparkles, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

type StudioProduct = {
  id: string
  name: string
  category: string
  imagePromptHint: string
}

type ImageStudioProps = {
  products: StudioProduct[]
  sandboxWindow: Window | null
}

type GenerateResponse = {
  url?: string
  filename?: string
  error?: string
  flagged?: boolean
}

type GenerationState = "idle" | "generating" | "ready" | "error"

export function ImageStudio({ products, sandboxWindow }: ImageStudioProps) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "")
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? products[0] ?? null,
    [products, selectedProductId],
  )
  const [context, setContext] = useState("")
  const [style, setStyle] = useState<"lifestyle" | "in-use">("lifestyle")
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [expandedPreview, setExpandedPreview] = useState(false)
  const [state, setState] = useState<GenerationState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [supportsRecording, setSupportsRecording] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    setSupportsRecording(typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices))
  }, [])

  useEffect(() => {
    if (!selectedProduct) return
    setContext("")
    setGeneratedUrl(null)
    setExpandedPreview(false)
    setError(null)
    setState("idle")
  }, [selectedProduct])

  async function generateImage() {
    if (!selectedProduct) return
    setState("generating")
    setError(null)
    setGeneratedUrl(null)

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          context: context.trim() || selectedProduct.imagePromptHint,
          style,
        }),
      })
      const payload = await readGenerateResponse(response)
      if (!response.ok) throw new Error(payload.error ?? "Image generation failed.")
      if (!payload.url) throw new Error("Image generation finished without an image URL.")
      setGeneratedUrl(payload.url)
      setExpandedPreview(false)
      setState("ready")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed.")
      setState("error")
    }
  }

  function useImage() {
    if (!generatedUrl || !selectedProduct) return
    sandboxWindow?.postMessage({ type: "useImage", productId: selectedProduct.id, url: generatedUrl }, "*")
  }

  async function startRecording() {
    if (!supportsRecording || recording) return

    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorderRef.current = recorder
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      })
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop())
        void transcribeRecording()
      })
      recorder.start(250)
      setRecording(true)
    } catch {
      setError("Microphone access was not available.")
    }
  }

  function stopRecording() {
    if (!recording) return
    setRecording(false)
    recorderRef.current?.stop()
  }

  function toggleRecording() {
    if (recording) {
      stopRecording()
      return
    }
    void startRecording()
  }

  async function transcribeRecording() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" })
    if (blob.size === 0) return

    setTranscribing(true)
    try {
      const formData = new FormData()
      formData.set("audio", blob, "image-prompt.webm")
      const response = await fetch("/api/transcribe", { method: "POST", body: formData })
      const payload = (await response.json()) as { text?: string; error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Transcription failed")
      setContext(payload.text ?? "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed")
    } finally {
      setTranscribing(false)
    }
  }

  const generating = state === "generating"

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Image studio</h2>
          <p className="mt-1 text-xs text-zinc-500">Regenerate product assets outside the store preview.</p>
        </div>
        <ImagePlus className="size-4 text-indigo-300" />
      </div>

      {selectedProduct ? (
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-medium text-zinc-400">Product</span>
            <select
              value={selectedProduct.id}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-50 outline-none transition focus:border-indigo-500"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
            <div className="aspect-square overflow-hidden rounded-md bg-white">
              <img src={`/images/${selectedProduct.id}-base.png`} alt={`Base ${selectedProduct.name}`} className="h-full w-full object-cover" />
            </div>
            <div className="grid min-h-24 place-items-center overflow-hidden rounded-md border border-zinc-700 bg-zinc-950">
              {generating ? (
                <div
                  data-testid="image-generating-skeleton"
                  className="grid h-full w-full place-items-center bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-900 text-xs text-zinc-300"
                >
                  Generating image
                </div>
              ) : generatedUrl ? (
                <button
                  type="button"
                  aria-label={`Open generated ${selectedProduct.name} preview`}
                  onClick={() => setExpandedPreview(true)}
                  className="h-full w-full cursor-zoom-in overflow-hidden text-left outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <img
                    src={generatedUrl}
                    alt={`Generated ${selectedProduct.name}`}
                    className="h-full w-full object-cover opacity-100 transition duration-300 hover:scale-[1.02]"
                  />
                </button>
              ) : (
                <span className="px-3 text-center text-xs text-zinc-500">Generate to preview</span>
              )}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-medium text-zinc-400">Scene / mood</span>
            <div className="flex gap-2">
              <textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                rows={3}
                className="min-w-0 flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-5 text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500"
                placeholder={recording ? "Listening..." : selectedProduct.imagePromptHint}
              />
              {supportsRecording ? (
                <button
                  type="button"
                  aria-label={recording ? "Stop recording image prompt" : "Record image prompt"}
                  aria-pressed={recording}
                  onClick={toggleRecording}
                  disabled={transcribing}
                  className={`grid size-10 shrink-0 place-items-center rounded-md border border-zinc-700 transition ${
                    recording ? "animate-pulse border-rose-500 text-rose-500" : "text-zinc-400 hover:text-zinc-200"
                  } disabled:opacity-50`}
                >
                  <Mic className="size-4" />
                </button>
              ) : null}
            </div>
          </label>

          <div className="flex rounded-md border border-zinc-700 bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => setStyle("lifestyle")}
              className={`h-8 flex-1 rounded px-3 text-sm transition ${style === "lifestyle" ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              Lifestyle
            </button>
            <button
              type="button"
              onClick={() => setStyle("in-use")}
              className={`h-8 flex-1 rounded px-3 text-sm transition ${style === "in-use" ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              In use
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void generateImage()}
              disabled={generating}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              <WandSparkles className="size-4" />
              {generating ? "Working..." : "Generate"}
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

          {state === "ready" ? <p className="text-sm text-emerald-400">Image ready. Apply it to update the preview.</p> : null}
          {transcribing ? <p className="text-sm text-zinc-400">Transcribing...</p> : null}
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          {expandedPreview && generatedUrl ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Generated ${selectedProduct.name} full-size preview`}
              className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
            >
              <div className="relative max-h-full w-full max-w-5xl">
                <button
                  type="button"
                  aria-label="Close generated image preview"
                  onClick={() => setExpandedPreview(false)}
                  className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-md border border-zinc-700 bg-zinc-950/90 text-zinc-200 shadow-lg transition hover:border-zinc-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
                <img
                  src={generatedUrl}
                  alt={`Generated ${selectedProduct.name} full size`}
                  className="max-h-[calc(100vh-2rem)] w-full rounded-md object-contain"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">No products available.</p>
      )}
    </section>
  )
}

async function readGenerateResponse(response: Response): Promise<GenerateResponse> {
  const text = await response.text()
  if (!text.trim()) {
    return { error: response.ok ? "Image generation returned an empty response." : "Image generation failed with an empty response." }
  }

  try {
    return JSON.parse(text) as GenerateResponse
  } catch {
    return { error: response.ok ? "Image generation returned an unreadable response." : "Image generation failed with an unreadable response." }
  }
}
