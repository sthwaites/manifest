"use client"

import { RefreshCw, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"

type Thread = {
  id: string
  summary: string | null
  createdAt: string
  updatedAt: string
  _count: {
    features: number
  }
}

type ThreadHistoryProps = {
  onRollbackComplete: () => void
}

export function ThreadHistory({ onRollbackComplete }: ThreadHistoryProps) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rollingBackId, setRollingBackId] = useState<string | null>(null)

  async function loadThreads() {
    setLoading(true)
    try {
      const response = await fetch("/api/threads")
      const payload = (await response.json()) as { threads?: Thread[]; error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Could not load threads")
      setThreads(payload.threads ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load threads")
    } finally {
      setLoading(false)
    }
  }

  async function rollback(thread: Thread) {
    setRollingBackId(thread.id)
    try {
      const response = await fetch("/api/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: thread.id }),
      })
      if (!response.ok) throw new Error("Rollback failed")
      onRollbackComplete()
      await loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed")
    } finally {
      setRollingBackId(null)
    }
  }

  useEffect(() => {
    void loadThreads()
  }, [])

  return (
    <aside className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Threads</h2>
        <button
          type="button"
          aria-label="Refresh threads"
          onClick={() => void loadThreads()}
          className="grid size-8 place-items-center rounded-md border border-zinc-800 text-zinc-400 transition hover:text-zinc-100"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {loading ? <p className="text-sm text-zinc-400">Loading threads...</p> : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {!loading && threads.length === 0 ? (
        <p className="text-sm text-zinc-400">No sessions yet. Describe a feature to get started.</p>
      ) : null}

      <div className="space-y-2">
        {threads.map((thread) => {
          const title = thread.summary ?? thread.id
          const featureLabel = `${thread._count.features} ${thread._count.features === 1 ? "feature" : "features"}`
          return (
            <article key={thread.id} className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-zinc-100">{title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">{featureLabel}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Undo ${title}`}
                  onClick={() => void rollback(thread)}
                  disabled={rollingBackId === thread.id}
                  className="grid size-8 shrink-0 place-items-center rounded-md border border-zinc-700 text-amber-400 transition hover:border-orange-500 hover:text-orange-400 disabled:opacity-50"
                >
                  <RotateCcw className="size-4" />
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </aside>
  )
}
