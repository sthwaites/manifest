"use client"

import { useMemo, useState } from "react"
import type { AgentEvent } from "./AgentStream"

type DebugPanelProps = {
  threadId: string | null
  events: AgentEvent[]
  onRollbackComplete?: () => void
  onResetComplete?: () => void
}

export function DebugPanel({ threadId, events, onRollbackComplete, onResetComplete }: DebugPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const hasCompletedTurn = events.some((event) => (event.method ?? event.type) === "turn/completed")
  const tokenCount = useMemo(() => events.reduce((total, event) => total + readTokenUsage(event), 0), [events])

  async function copyLog() {
    await navigator.clipboard.writeText(JSON.stringify(events, null, 2))
    setToast("Session log copied")
  }

  async function rollback() {
    if (!threadId) return
    const response = await fetch("/api/rollback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId }),
    })
    const payload = (await response.json()) as { message?: string; error?: string }
    if (!response.ok) {
      setToast(payload.error ?? "Rollback failed")
      return
    }
    setToast(payload.message ?? "Rolled back to previous state")
    onRollbackComplete?.()
  }

  async function reset() {
    const response = await fetch("/api/reset", { method: "POST" })
    const payload = (await response.json()) as { message?: string; error?: string }
    if (!response.ok) {
      setToast(payload.error ?? "Reset failed")
      return
    }
    setToast(payload.message ?? "Sandbox reset to baseline")
    setConfirmingReset(false)
    onResetComplete?.()
  }

  return (
    <section className="rounded-lg border border-zinc-700 bg-zinc-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-700 p-4">
        <div>
          <h2 className="text-sm font-semibold">Debug</h2>
          <div className="mt-1 flex gap-3 text-xs text-zinc-400">
            <span>{threadId ?? "No thread"}</span>
            <span className="tabular-nums">{tokenCount} tokens</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyLog} className="h-8 rounded-md border border-zinc-700 px-3 text-xs text-zinc-300 transition hover:text-zinc-50">
            Copy session log
          </button>
          <button
            type="button"
            onClick={rollback}
            disabled={!hasCompletedTurn || !threadId}
            className="h-8 rounded-md border border-zinc-700 px-3 text-xs text-zinc-400 transition hover:text-zinc-50 disabled:opacity-50"
          >
            Undo last change
          </button>
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="h-8 rounded-md border border-zinc-700 px-3 text-xs text-orange-400 transition hover:text-orange-300"
          >
            Reset to baseline
          </button>
        </div>
      </header>

      {toast ? <p className="border-b border-zinc-700 px-4 py-2 text-sm text-emerald-400">{toast}</p> : null}

      <div className="max-h-[680px] overflow-auto p-4">
        {events.length === 0 ? <p className="text-sm text-zinc-400">No debug events yet.</p> : null}
        <div className="space-y-2">
          {events.map((event, index) => {
            const type = event.method ?? event.type ?? "event"
            const timestamp = typeof event.timestamp === "string" ? event.timestamp : "pending"
            const preview = JSON.stringify(event).slice(0, 120)
            const expanded = expandedIndex === index

            return (
              <article key={`${type}-${index}`} className="rounded-md border border-zinc-700 bg-zinc-950">
                <button
                  type="button"
                  aria-label={`${type} ${timestamp}`}
                  onClick={() => setExpandedIndex(expanded ? null : index)}
                  className="grid w-full grid-cols-[180px_160px_minmax(0,1fr)] gap-3 px-3 py-2 text-left font-mono text-xs text-zinc-300"
                >
                  <span>{timestamp}</span>
                  <span>{type}</span>
                  <span className="truncate text-zinc-500">{preview}</span>
                </button>
                {expanded ? (
                  <div className="border-t border-zinc-700 p-3">
                    {typeof event.diff === "string" ? <DiffView diff={event.diff} /> : null}
                    <pre className="mt-2 overflow-auto rounded bg-zinc-900 p-3 font-mono text-xs text-zinc-300">
                      {JSON.stringify(event, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>

      {confirmingReset ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/80 px-4">
          <section className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-5">
            <h3 className="text-base font-semibold">Reset to baseline</h3>
            <p className="mt-2 text-sm text-zinc-300">
              This will discard all Codex changes and return the catalogue to its original state.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmingReset(false)} className="h-9 rounded-md border border-zinc-700 px-3 text-sm text-zinc-300">
                Cancel
              </button>
              <button type="button" onClick={() => void reset()} className="h-9 rounded-md bg-orange-500 px-3 text-sm font-medium text-white">
                Confirm reset
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="overflow-auto rounded bg-zinc-900 p-3 font-mono text-xs">
      {diff.split("\n").map((line, index) => (
        <span key={`${line}-${index}`} className={line.startsWith("+") ? "block text-emerald-400" : line.startsWith("-") ? "block text-rose-400" : "block text-zinc-400"}>
          {line}
        </span>
      ))}
    </pre>
  )
}

function readTokenUsage(event: AgentEvent) {
  const params = readObject(event, "params")
  const usage = params ? readObject(params, "tokenUsage") : readObject(event, "tokenUsage")
  const total = usage ? readNumber(usage, "total") ?? readNumber(usage, "totalTokens") : null
  return total ?? 0
}

function readObject(source: object, key: string) {
  if (!(key in source)) return null
  const value = source[key as keyof typeof source]
  return value && typeof value === "object" ? value : null
}

function readNumber(source: object, key: string) {
  if (!(key in source)) return null
  const value = source[key as keyof typeof source]
  return typeof value === "number" ? value : null
}
