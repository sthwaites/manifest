"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ClipboardCopy, TerminalSquare } from "lucide-react"
import type { AgentEvent } from "./AgentStream"

type DebugPanelProps = {
  threadId: string | null
  events: AgentEvent[]
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

export function DebugPanel({ threadId, events }: DebugPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const tokenCount = useMemo(() => events.reduce((total, event) => total + readTokenUsage(event), 0), [events])
  const displayEvents = useMemo(() => events.map((event, index) => ({ event, originalIndex: index })).reverse(), [events])

  async function copyLog() {
    await navigator.clipboard.writeText(JSON.stringify(events, null, 2))
    setToast("Session log copied")
  }

  return (
    <section className="h-full rounded-lg border border-zinc-800 bg-zinc-900">
      <header className="border-b border-zinc-800 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Agent progress</h2>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-400">
              <span>{threadId ?? "No thread"}</span>
              <span className="tabular-nums">{tokenCount} tokens</span>
            </div>
          </div>
          <TerminalSquare className="size-4 text-zinc-500" />
        </div>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={copyLog}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-300 transition hover:text-zinc-50"
          >
            <ClipboardCopy className="size-3.5" />
            Copy session log
            <span className="text-zinc-500">(advanced)</span>
          </button>
        </div>
      </header>

      {toast ? <p className="border-b border-zinc-800 px-4 py-2 text-sm text-emerald-400">{toast}</p> : null}

      <div className="max-h-[460px] overflow-auto">
        {events.length === 0 ? <p className="p-4 text-sm text-zinc-400">No agent progress events yet.</p> : null}
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
              {displayEvents.map(({ event, originalIndex }) => {
                const summary = summarizeEvent(event)
                const expanded = expandedIndex === originalIndex
                const hasDiff = typeof event.diff === "string" && event.diff.length > 0

                return (
                  <tr key={`${summary.event}-${originalIndex}`} className="border-b border-zinc-800/80 align-top">
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
                            onClick={() => setExpandedIndex(expanded ? null : originalIndex)}
                            className="inline-flex items-center gap-1 text-amber-300 transition hover:text-amber-200"
                          >
                            <ChevronDown className={`size-3 transition ${expanded ? "rotate-180" : ""}`} />
                            View diff
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setExpandedIndex(expanded ? null : originalIndex)}
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
