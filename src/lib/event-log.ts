import type { AppServerEvent } from "./event-bus"

export type LoggedEvent = AppServerEvent & {
  timestamp: string
}

const globalForEventLog = globalThis as unknown as {
  manifestEventLog?: Map<string, LoggedEvent[]>
}

function getStore() {
  if (!globalForEventLog.manifestEventLog) {
    globalForEventLog.manifestEventLog = new Map<string, LoggedEvent[]>()
  }
  return globalForEventLog.manifestEventLog
}

export function recordThreadEvent(event: AppServerEvent) {
  const threadId = getThreadId(event)
  if (!threadId) return

  const store = getStore()
  const current = store.get(threadId) ?? []
  current.push({ ...event, timestamp: new Date().toISOString() })
  store.set(threadId, current)
}

export function getThreadEvents(threadId: string): LoggedEvent[] {
  return getStore().get(threadId) ?? []
}

function getThreadId(event: AppServerEvent) {
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
