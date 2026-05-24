"use client"

import { useCallback, useRef, useState } from "react"
import { Activity, CheckCircle2, ChevronDown, CircleOff, RefreshCw } from "lucide-react"
import { AgentStream, type AgentEvent } from "./AgentStream"
import { DebugPanel } from "./DebugPanel"
import { FeatureRequest } from "./FeatureRequest"
import { ImageStudio } from "./ImageStudio"
import { ThreadHistory } from "./ThreadHistory"
import seedProducts from "../../seed/products.json"

export function CatalogueWorkspace() {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [flash, setFlash] = useState<"hot" | "rollback" | null>(null)
  const [agentProgressOpen, setAgentProgressOpen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const currentThreadId = findCurrentThreadId(events)

  const appendEvent = useCallback((event: AgentEvent) => {
    setEvents((current) => [...current, event])

    if (event.type === "fileChange") {
      setFlash("hot")
      window.setTimeout(() => setFlash(null), 600)
    }

    if (event.type === "turn/completed") {
      window.setTimeout(() => {
        if (iframeRef.current) {
          // Next dev HMR can miss file changes from the agent process; reload the iframe after a completed turn.
          iframeRef.current.src = iframeRef.current.src
        }
        setFlash("hot")
        window.setTimeout(() => setFlash(null), 400)
      }, 1500)
    }
  }, [])

  const handleRollbackComplete = useCallback(() => {
    setFlash("rollback")
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src
    }
    window.setTimeout(() => setFlash(null), 400)
  }, [])

  const refreshSandbox = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src
    }
    setFlash("hot")
    window.setTimeout(() => setFlash(null), 400)
  }, [])

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-5 py-4 lg:px-6">
        <div>
          <h1 className="text-xl font-semibold">Manifest</h1>
          <p className="text-sm text-zinc-400">Internal catalogue build cockpit</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm">
          {connected ? <CheckCircle2 className="size-4 text-emerald-400" /> : <CircleOff className="size-4 text-zinc-500" />}
          <span className={connected ? "text-emerald-300" : "text-zinc-400"}>{connected ? "App Server connected" : "App Server disconnected"}</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_440px] lg:p-5">
        <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/30 lg:min-h-[calc(100vh-112px)]">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Live sandbox</h2>
              <p className="text-xs text-zinc-500">http://localhost:3001</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              <button
                type="button"
                aria-label="Refresh sandbox"
                onClick={refreshSandbox}
                className="grid size-8 place-items-center rounded-md border border-zinc-700 text-zinc-400 transition hover:border-indigo-500 hover:text-zinc-100"
              >
                <RefreshCw className="size-3.5" />
              </button>
              {flash === "hot" ? (
                <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-300">
                  <Activity className="size-3" />
                  Hot reload
                </span>
              ) : null}
              {flash === "rollback" ? (
                <span className="inline-flex items-center gap-1 rounded border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-orange-300">
                  <RefreshCw className="size-3" />
                  Restored
                </span>
              ) : null}
              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-300">Catalogue visible</span>
            </div>
          </div>
          <div
            className={`min-h-0 flex-1 bg-white transition ${
              flash === "hot" ? "ring-2 ring-inset ring-amber-400 ring-pulse-amber" : ""
            } ${flash === "rollback" ? "ring-2 ring-inset ring-orange-500 ring-pulse-orange" : ""}`}
          >
            <iframe ref={iframeRef} title="Sandbox catalogue" src="http://localhost:3001/" className="h-full min-h-[560px] w-full bg-white lg:min-h-0" />
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-4 lg:max-h-[calc(100vh-112px)] lg:overflow-auto">
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Feature request</h2>
              <span className={`inline-flex items-center gap-1 text-xs ${connected ? "text-emerald-400" : "text-zinc-500"}`}>
                {connected ? <CheckCircle2 className="size-3.5" /> : <CircleOff className="size-3.5" />}
                {connected ? "connected" : "disconnected"}
              </span>
            </div>
            <FeatureRequest onEvent={appendEvent} onConnectionChange={setConnected} />
          </section>

          <ImageStudio products={seedProducts} sandboxWindow={iframeRef.current?.contentWindow ?? null} />

          <ThreadHistory onRollbackComplete={handleRollbackComplete} />

          <DebugPanel
            threadId={currentThreadId}
            events={events}
            onRollbackComplete={handleRollbackComplete}
            onResetComplete={handleRollbackComplete}
          />

          <section className="rounded-lg border border-zinc-800 bg-zinc-900">
            <button
              type="button"
              onClick={() => setAgentProgressOpen((open) => !open)}
              aria-expanded={agentProgressOpen}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <span className="text-sm font-semibold">Agent progress</span>
              <span className="flex items-center gap-2 text-xs tabular-nums text-zinc-500">
                {events.length} events
                <ChevronDown className={`size-4 transition ${agentProgressOpen ? "rotate-180" : ""}`} />
              </span>
            </button>
            {agentProgressOpen ? (
              <div className="border-t border-zinc-800 p-4 pt-3">
                <div className="max-h-80 overflow-auto pr-1">
                  <AgentStream events={events} />
                </div>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  )
}

function findCurrentThreadId(events: AgentEvent[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const id = readThreadId(events[index])
    if (id) return id
  }
  return null
}

function readThreadId(event: AgentEvent) {
  const params = readObject(event, "params") ?? event
  return readString(params, "threadId") ?? readString(params, "id") ?? readNestedString(params, "thread", "id")
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

function readNestedString(source: object, objectKey: string, valueKey: string) {
  const nested = readObject(source, objectKey)
  return nested ? readString(nested, valueKey) : null
}
