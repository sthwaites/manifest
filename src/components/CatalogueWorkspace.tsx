"use client"

import { useCallback, useRef, useState } from "react"
import { AgentStream, type AgentEvent } from "./AgentStream"
import { FeatureRequest } from "./FeatureRequest"

type Tab = "app" | "agent" | "debug"

export function CatalogueWorkspace() {
  const [tab, setTab] = useState<Tab>("app")
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [flash, setFlash] = useState<"hot" | "reload" | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const appendEvent = useCallback((event: AgentEvent) => {
    setEvents((current) => [...current, event])

    if (event.type === "fileChange") {
      setFlash("hot")
      window.setTimeout(() => setFlash(null), 600)
    }

    if (event.type === "turn/completed") {
      window.setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = iframeRef.current.src
        }
        setFlash("reload")
        window.setTimeout(() => setFlash(null), 400)
      }, 1500)
    }
  }, [])

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-700 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Manifest</h1>
          <p className="text-sm text-zinc-400">Local catalogue workspace</p>
        </div>
        <div className="flex rounded-md border border-zinc-700 bg-zinc-900 p-1">
          {(["app", "agent", "debug"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`h-8 rounded px-3 text-sm capitalize transition ${
                tab === item ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {tab === "app" ? (
          <section className={`h-full min-h-[720px] bg-white transition ${flash === "hot" ? "ring-2 ring-amber-400" : ""} ${flash === "reload" ? "ring-2 ring-orange-500" : ""}`}>
            <iframe ref={iframeRef} title="Sandbox catalogue" src="/sandbox-preview/" className="h-full min-h-[720px] w-full bg-white" />
          </section>
        ) : null}

        {tab === "agent" ? (
          <section className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-6">
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Feature request</h2>
                <span className={`text-xs ${connected ? "text-emerald-500" : "text-zinc-500"}`}>
                  {connected ? "connected" : "disconnected"}
                </span>
              </div>
              <FeatureRequest onEvent={appendEvent} onConnectionChange={setConnected} />
            </div>
            <AgentStream events={events} />
          </section>
        ) : null}

        {tab === "debug" ? (
          <section className="mx-auto max-w-4xl px-6 py-6">
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
              <h2 className="text-sm font-semibold">Debug</h2>
              <p className="mt-2 text-sm text-zinc-400">Debug panel coming in Beat 7</p>
              <pre className="mt-4 max-h-[560px] overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-300">
                {JSON.stringify(events, null, 2)}
              </pre>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
