"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, CircleOff, LogOut, RefreshCw, ShieldCheck, UserRound } from "lucide-react"
import { AgentStream, type AgentEvent } from "./AgentStream"
import { DebugPanel } from "./DebugPanel"
import { FeatureRequest } from "./FeatureRequest"
import { ImageStudio } from "./ImageStudio"
import { ThreadHistory } from "./ThreadHistory"
import seedProducts from "../../seed/products.json"

type CatalogueWorkspaceProps = {
  userName?: string | null
  userEmail?: string | null
  debugAuthEnabled?: boolean
  sandboxUrl?: string
  logoutAction?: (formData: FormData) => void | Promise<void>
}

type SandboxHealth = {
  status: "checking" | "online" | "unavailable"
  message: string
}

export function CatalogueWorkspace({ userName = null, userEmail = null, debugAuthEnabled = false, sandboxUrl = "http://localhost:3001/", logoutAction }: CatalogueWorkspaceProps) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [flash, setFlash] = useState<"hot" | "rollback" | null>(null)
  const [sandboxHealth, setSandboxHealth] = useState<SandboxHealth>({
    status: "checking",
    message: "Checking sandbox.",
  })
  const [agentProgressOpen, setAgentProgressOpen] = useState(false)
  const [identityOpen, setIdentityOpen] = useState(false)
  const [sandboxReloadToken, setSandboxReloadToken] = useState(0)
  const [threadRefreshToken, setThreadRefreshToken] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const currentThreadId = findCurrentThreadId(events)
  const displayName = userName || userEmail || "Signed in"
  const displayEmail = userEmail && userEmail !== displayName ? userEmail : null
  const sandboxFrameUrl = cacheBustUrl(sandboxUrl, sandboxReloadToken)

  const checkSandboxHealth = useCallback(async () => {
    setSandboxHealth({ status: "checking", message: "Checking sandbox." })
    try {
      const response = await fetch("/api/health", { cache: "no-store" })
      const payload = (await response.json()) as {
        services?: {
          sandbox?: {
            status?: string
            message?: string
          }
        }
      }
      const sandbox = payload.services?.sandbox
      if (response.ok && sandbox?.status === "ok") {
        setSandboxHealth({ status: "online", message: sandbox.message ?? "Sandbox is reachable." })
        return
      }
      setSandboxHealth({
        status: "unavailable",
        message: sandbox?.message ?? "Sandbox is not reachable.",
      })
    } catch {
      setSandboxHealth({ status: "unavailable", message: "Sandbox health check failed." })
    }
  }, [])

  useEffect(() => {
    void checkSandboxHealth()
  }, [checkSandboxHealth])

  useEffect(() => {
    if (sandboxHealth.status !== "unavailable") return
    const interval = window.setInterval(() => void checkSandboxHealth(), 5000)
    return () => window.clearInterval(interval)
  }, [checkSandboxHealth, sandboxHealth.status])

  useEffect(() => {
    if (sandboxHealth.status !== "online") return
    setSandboxReloadToken(Date.now())
  }, [sandboxHealth.status])

  const appendEvent = useCallback((event: AgentEvent) => {
    const eventType = event.method ?? event.type
    setEvents((current) => [...current, event])

    if (eventType === "fileChange") {
      setFlash("hot")
      window.setTimeout(() => setFlash(null), 600)
    }

    if (eventType === "turn/completed") {
      window.setTimeout(() => {
        // Next dev HMR can miss file changes from the agent process; reload the iframe after a completed turn.
        setSandboxReloadToken(Date.now())
        setFlash("hot")
        window.setTimeout(() => setFlash(null), 400)
      }, 1500)
    }
  }, [])

  const handleRollbackComplete = useCallback(() => {
    setEvents([])
    setFlash("rollback")
    setSandboxReloadToken(Date.now())
    setThreadRefreshToken((token) => token + 1)
    void checkSandboxHealth()
    window.setTimeout(() => setFlash(null), 400)
  }, [checkSandboxHealth])

  const refreshSandbox = useCallback(() => {
    setSandboxReloadToken(Date.now())
    void checkSandboxHealth()
    setFlash("hot")
    window.setTimeout(() => setFlash(null), 400)
  }, [checkSandboxHealth])

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-5 py-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md border border-indigo-400/30 bg-indigo-400/10 text-sm font-semibold text-indigo-200 shadow-inner shadow-indigo-500/10">
            M
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-normal">Manifest</h1>
              <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-400">cockpit</span>
            </div>
            <p className="text-sm text-zinc-400">Internal catalogue build cockpit</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm">
            {connected ? <CheckCircle2 className="size-4 text-emerald-400" /> : <CircleOff className="size-4 text-zinc-500" />}
            <span className={connected ? "text-emerald-300" : "text-zinc-400"}>{connected ? "App Server connected" : "App Server disconnected"}</span>
          </div>
          {debugAuthEnabled ? (
            <div className="inline-flex h-10 items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-sm font-medium text-amber-200">
              <ShieldCheck className="size-4" />
              Debug mode
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIdentityOpen((open) => !open)}
                aria-expanded={identityOpen}
                aria-label="Open user menu"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 text-sm text-zinc-200 transition hover:border-indigo-500 hover:text-zinc-50"
              >
                <span className="grid size-6 place-items-center rounded bg-zinc-800 text-xs font-semibold text-indigo-200">
                  {initialFor(displayName)}
                </span>
                <span className="max-w-36 truncate">{displayName}</span>
                <ChevronDown className={`size-4 text-zinc-500 transition ${identityOpen ? "rotate-180" : ""}`} />
              </button>
              {identityOpen ? (
                <div className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-2xl shadow-black/40">
                  <div className="flex items-start gap-3 border-b border-zinc-800 px-2 py-2">
                    <div className="grid size-8 shrink-0 place-items-center rounded bg-zinc-800 text-xs font-semibold text-indigo-200">
                      {initialFor(displayName)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100">{displayName}</p>
                      {displayEmail ? <p className="truncate text-xs text-zinc-500">{displayEmail}</p> : null}
                    </div>
                  </div>
                  {logoutAction ? (
                    <form action={logoutAction} className="pt-2">
                      <button
                        type="submit"
                        className="inline-flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-50"
                      >
                        <LogOut className="size-4 text-zinc-500" />
                        Log out
                      </button>
                    </form>
                  ) : (
                    <div className="inline-flex h-9 w-full items-center gap-2 px-2 text-sm text-zinc-500">
                      <UserRound className="size-4" />
                      Session active
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_440px] lg:p-5">
        <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/30 lg:min-h-[calc(100vh-112px)]">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Live sandbox</h2>
              <p className="text-xs text-zinc-500">{sandboxUrl}</p>
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
              <SandboxHealthBadge health={sandboxHealth} />
            </div>
          </div>
          <div
            className={`relative min-h-0 flex-1 bg-white transition ${
              flash === "hot" ? "ring-2 ring-inset ring-amber-400 ring-pulse-amber" : ""
            } ${flash === "rollback" ? "ring-2 ring-inset ring-orange-500 ring-pulse-orange" : ""}`}
          >
            <iframe ref={iframeRef} title="Sandbox catalogue" src={sandboxFrameUrl} className="h-full min-h-[560px] w-full bg-white lg:min-h-0" />
            {sandboxHealth.status === "unavailable" ? (
              <div className="absolute inset-0 grid place-items-center bg-zinc-950/85 px-6 text-center text-zinc-100">
                <div className="max-w-md space-y-3">
                  <div className="mx-auto grid size-10 place-items-center rounded-md border border-amber-400/50 bg-amber-400/10 text-amber-300">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Sandbox unavailable</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-300">{sandboxHealth.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={refreshSandbox}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-600 px-3 text-sm font-medium text-zinc-100 transition hover:border-indigo-400 hover:text-indigo-200"
                  >
                    <RefreshCw className="size-4" />
                    Check again
                  </button>
                </div>
              </div>
            ) : null}
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
            <FeatureRequest
              onEvent={appendEvent}
              onConnectionChange={setConnected}
              threadId={currentThreadId}
              events={events}
              onRollbackComplete={handleRollbackComplete}
              onResetComplete={handleRollbackComplete}
            />
          </section>

          <ImageStudio products={seedProducts} sandboxWindow={iframeRef.current?.contentWindow ?? null} />

          <ThreadHistory onRollbackComplete={handleRollbackComplete} refreshToken={threadRefreshToken} />

          <DebugPanel threadId={currentThreadId} events={events} />

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

function SandboxHealthBadge({ health }: { health: SandboxHealth }) {
  if (health.status === "online") {
    return <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-300">Catalogue online</span>
  }
  if (health.status === "unavailable") {
    return <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-300">Sandbox unavailable</span>
  }
  return <span className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-300">Checking sandbox</span>
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

function initialFor(value: string) {
  return value.trim().charAt(0).toUpperCase() || "U"
}

function cacheBustUrl(url: string, token: number) {
  try {
    const base = typeof window === "undefined" ? "http://localhost" : window.location.href
    const parsed = new URL(url, base)
    parsed.searchParams.set("__manifest_reload", String(token))
    if (url.startsWith("/")) return `${parsed.pathname}${parsed.search}${parsed.hash}`
    return parsed.toString()
  } catch {
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}__manifest_reload=${token}`
  }
}
