"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ClipboardCopy, RotateCcw, RotateCw, TerminalSquare, Undo2 } from "lucide-react"
import type { AgentEvent } from "./AgentStream"

type DebugPanelProps = {
  threadId: string | null
  events: AgentEvent[]
  onRollbackComplete?: () => void
  onResetComplete?: () => void
}

type EventSummary = {
  time: string
  event: string
  summary: string
  status: string
  target: string
  tokens: number
  tone: "default" | "success" | "warning" | "danger" | "primary"
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
    <section className="rounded-lg border border-zinc-800 bg-zinc-900">
      <header className="border-b border-zinc-800 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Debug inspection</h2>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-400">
              <span>{threadId ?? "No thread"}</span>
              <span className="tabular-nums">{tokenCount} tokens</span>
            </div>
          </div>
          <TerminalSquare className="size-4 text-zinc-500" />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={rollback}
            disabled={!hasCompletedTurn || !threadId}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-orange-500/40 px-3 text-xs font-medium text-orange-300 transition hover:border-orange-400 hover:text-orange-200 disabled:border-zinc-800 disabled:text-zinc-600 disabled:opacity-70"
          >
            <Undo2 className="size-3.5" />
            Undo last change
          </button>
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-orange-500 px-3 text-xs font-medium text-white transition hover:bg-orange-400"
          >
            <RotateCcw className="size-3.5" />
            Reset baseline
          </button>
          <button
            type="button"
            onClick={copyLog}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-300 transition hover:text-zinc-50 sm:col-span-2"
          >
            <ClipboardCopy className="size-3.5" />
            Copy session log
            <span className="text-zinc-500">(advanced)</span>
          </button>
        </div>
      </header>

      {toast ? <p className="border-b border-zinc-800 px-4 py-2 text-sm text-emerald-400">{toast}</p> : null}

      <div className="max-h-[520px] overflow-auto">
        {events.length === 0 ? <p className="p-4 text-sm text-zinc-400">No debug events yet.</p> : null}
        {events.length > 0 ? (
          <table className="min-w-[760px] w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Summary</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">File/Command</th>
                <th className="px-3 py-2 text-right font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, index) => {
                const summary = summarizeEvent(event)
                const expanded = expandedIndex === index
                const hasDiff = typeof event.diff === "string" && event.diff.length > 0

                return (
                  <tr key={`${summary.event}-${index}`} className="border-b border-zinc-800/80 align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-400">{summary.time}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded px-2 py-1 font-medium ${toneClass(summary.tone)}`}>{summary.event}</span>
                    </td>
                    <td className="max-w-[240px] px-3 py-2 text-zinc-200">
                      <p className="leading-5">{summary.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {hasDiff ? (
                          <button
                            type="button"
                            onClick={() => setExpandedIndex(expanded ? null : index)}
                            className="inline-flex items-center gap-1 text-amber-300 transition hover:text-amber-200"
                          >
                            <ChevronDown className={`size-3 transition ${expanded ? "rotate-180" : ""}`} />
                            View diff
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setExpandedIndex(expanded ? null : index)}
                          className="inline-flex items-center gap-1 text-zinc-400 transition hover:text-zinc-100"
                        >
                          <ChevronDown className={`size-3 transition ${expanded ? "rotate-180" : ""}`} />
                          View raw JSON
                        </button>
                      </div>
                      {expanded ? (
                        <div className="mt-3 space-y-2">
                          {hasDiff ? <DiffView diff={event.diff as string} /> : null}
                          <pre className="max-h-72 overflow-auto rounded bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
                            {JSON.stringify(event, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{summary.status}</td>
                    <td className="max-w-[170px] px-3 py-2 font-mono text-zinc-400">
                      <span className="block truncate">{summary.target}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{summary.tokens || "-"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : null}
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
              <button type="button" onClick={() => void reset()} className="inline-flex h-9 items-center gap-2 rounded-md bg-orange-500 px-3 text-sm font-medium text-white">
                <RotateCw className="size-4" />
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
    <pre className="overflow-auto rounded bg-zinc-950 p-3 font-mono text-xs">
      {diff.split("\n").map((line, index) => (
        <span key={`${line}-${index}`} className={line.startsWith("+") ? "block text-emerald-400" : line.startsWith("-") ? "block text-rose-400" : "block text-zinc-400"}>
          {line}
        </span>
      ))}
    </pre>
  )
}

function summarizeEvent(event: AgentEvent): EventSummary {
  const type = event.method ?? event.type ?? "event"
  const params = readObject(event, "params") ?? event
  const tokens = readTokenUsage(event)
  const status = readStatus(event)

  if (event.error || event.flagged) {
    return {
      time: formatTime(event.timestamp),
      event: event.flagged ? "Moderation" : "Error",
      summary: event.flagged ? "Prompt was blocked by moderation." : readString(event, "error") ?? "The request could not be completed.",
      status: "Needs attention",
      target: "-",
      tokens,
      tone: "danger",
    }
  }

  if (type === "thread/started") {
    return {
      time: formatTime(event.timestamp),
      event: "Thread started",
      summary: `Session ${readNestedString(params, "thread", "id") ?? readString(params, "threadId") ?? readString(params, "id") ?? "created"}`,
      status,
      target: "-",
      tokens,
      tone: "primary",
    }
  }

  if (type === "agentMessage" || type === "reasoning") {
    return {
      time: formatTime(event.timestamp),
      event: type === "reasoning" ? "Reasoning" : "Agent message",
      summary: readString(event, "message") ?? readString(event, "text") ?? "Agent update",
      status,
      target: "-",
      tokens,
      tone: "primary",
    }
  }

  if (type === "fileChange") {
    const target = readString(event, "path") ?? readString(event, "filename") ?? "changed file"
    return {
      time: formatTime(event.timestamp),
      event: "File changed",
      summary: `Updated ${target}`,
      status: readString(event, "status") ?? "Modified",
      target,
      tokens,
      tone: "warning",
    }
  }

  if (type === "commandExecution") {
    const exitCode = readNumber(event, "exitCode")
    const command = readString(event, "command") ?? "Command"
    return {
      time: formatTime(event.timestamp),
      event: "Command run",
      summary: exitCode === null ? "Command started." : `Command exited ${exitCode}.`,
      status: exitCode === 0 ? "Passed" : exitCode === null ? status : "Failed",
      target: command,
      tokens,
      tone: exitCode === 0 ? "success" : exitCode === null ? "default" : "danger",
    }
  }

  if (type === "turn/completed") {
    return {
      time: formatTime(event.timestamp),
      event: "Turn completed",
      summary: "Catalogue update finished.",
      status: "Applied",
      target: readNestedString(params, "turn", "id") ?? readString(params, "turnId") ?? "-",
      tokens,
      tone: "success",
    }
  }

  return {
    time: formatTime(event.timestamp),
    event: type,
    summary: readString(event, "message") ?? readString(event, "text") ?? "Event received.",
    status,
    target: readString(event, "path") ?? readString(event, "command") ?? "-",
    tokens,
    tone: "default",
  }
}

function toneClass(tone: EventSummary["tone"]) {
  if (tone === "success") return "bg-emerald-500/10 text-emerald-300"
  if (tone === "warning") return "bg-amber-500/10 text-amber-300"
  if (tone === "danger") return "bg-rose-500/10 text-rose-300"
  if (tone === "primary") return "bg-indigo-500/10 text-indigo-300"
  return "bg-zinc-800 text-zinc-300"
}

function formatTime(value: unknown) {
  if (typeof value !== "string") return "pending"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function readStatus(event: AgentEvent) {
  if (typeof event.status === "string") return event.status
  return "Received"
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

function readString(source: object, key: string) {
  if (!(key in source)) return null
  const value = source[key as keyof typeof source]
  return typeof value === "string" ? value : null
}

function readNumber(source: object, key: string) {
  if (!(key in source)) return null
  const value = source[key as keyof typeof source]
  return typeof value === "number" ? value : null
}

function readNestedString(source: object, objectKey: string, valueKey: string) {
  const nested = readObject(source, objectKey)
  return nested ? readString(nested, valueKey) : null
}
