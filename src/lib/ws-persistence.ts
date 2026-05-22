import { execSync } from "child_process"
import { prisma } from "@/lib/prisma"
import type { AppServerEvent } from "./event-bus"

export type PersistenceState = {
  currentThreadId: string | null
  activeFeatureId: string | null
  fileChanges: string[]
}

const debugUser = {
  id: "debug-user",
  email: "dev@localhost",
  name: "Dev User",
}

export function createPersistenceState(): PersistenceState {
  return {
    currentThreadId: null,
    activeFeatureId: null,
    fileChanges: [],
  }
}

export async function persistFeatureRequest(state: PersistenceState, prompt: string) {
  if (!state.currentThreadId) return

  const feature = await prisma.feature.create({
    data: {
      threadId: state.currentThreadId,
      prompt,
      status: "pending",
    },
  })
  state.activeFeatureId = feature.id
  state.fileChanges = []
}

export async function persistAppServerEvent(event: AppServerEvent, state: PersistenceState, sandboxDir: string) {
  const method = event.method ?? event.type

  if (method === "thread/started") {
    const threadId = getThreadId(event)
    if (!threadId) return
    state.currentThreadId = threadId
    await ensureThread(threadId)
    return
  }

  if (method === "fileChange") {
    const diff = formatFileChange(event)
    if (diff) state.fileChanges.push(diff)
    return
  }

  if (method === "turn/completed") {
    await completeFeature(event, state, sandboxDir)
  }
}

async function ensureThread(threadId: string) {
  await prisma.user.upsert({
    where: { id: debugUser.id },
    update: { email: debugUser.email, name: debugUser.name },
    create: debugUser,
  })

  await prisma.thread.upsert({
    where: { id: threadId },
    update: { userId: debugUser.id },
    create: {
      id: threadId,
      userId: debugUser.id,
      summary: "Codex session",
    },
  })
}

async function completeFeature(event: AppServerEvent, state: PersistenceState, sandboxDir: string) {
  if (!state.activeFeatureId || !state.currentThreadId) return

  const diff = state.fileChanges.join("\n\n") || null
  await prisma.feature.update({
    where: { id: state.activeFeatureId },
    data: {
      diff,
      status: "applied",
    },
  })

  const turnId = sanitizeCommitSegment(getTurnId(event) ?? "unknown")
  const threadId = sanitizeCommitSegment(state.currentThreadId)
  try {
    execSync(`git add -A && git commit -m "turn:${turnId} thread:${threadId}"`, { cwd: sandboxDir })
  } catch {
    // A turn may complete without file changes; persistence should still reflect completion.
  }

  state.activeFeatureId = null
  state.fileChanges = []
}

function formatFileChange(event: AppServerEvent) {
  const path = readString(event, "path") ?? readString(event, "filename") ?? "changed file"
  const diff = readString(event, "diff")
  if (!diff) return path
  return `${path}\n${diff}`
}

function getThreadId(event: AppServerEvent) {
  const params = readObject(event, "params") ?? event
  return readString(params, "threadId") ?? readString(params, "id") ?? readNestedString(params, "thread", "id")
}

function getTurnId(event: AppServerEvent) {
  const params = readObject(event, "params") ?? event
  return readString(params, "turnId") ?? readString(params, "id") ?? readNestedString(params, "turn", "id")
}

function sanitizeCommitSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)
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
