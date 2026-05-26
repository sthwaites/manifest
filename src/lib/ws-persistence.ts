import { execSync } from "child_process";
import { prisma } from "@/lib/prisma";
import type { AppServerEvent } from "./event-bus";

export type PersistenceState = {
  currentThreadId: string | null;
  activeFeatureId: string | null;
  fileChanges: string[];
  user: PersistenceUser;
};

type PersistenceUser = {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
};

const debugUser: PersistenceUser = {
  id: "debug-user",
  email: "dev@localhost",
  name: "Dev User",
};

export function createPersistenceState(): PersistenceState {
  return {
    currentThreadId: null,
    activeFeatureId: null,
    fileChanges: [],
    user: debugUser,
  };
}

export function setPersistenceUser(state: PersistenceState, user: PersistenceUser | null) {
  state.user = user ?? debugUser;
}

export async function findPersistenceUserBySessionToken(sessionToken: string | null | undefined) {
  if (process.env.DEBUG_AUTH === "true") return debugUser;
  if (!sessionToken) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: { user: true },
  });
  if (!session?.user || session.expires.getTime() <= Date.now()) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
}

export async function persistFeatureRequest(
  state: PersistenceState,
  prompt: string,
) {
  if (!state.currentThreadId) return;

  const feature = await prisma.feature.create({
    data: {
      threadId: state.currentThreadId,
      prompt,
      status: "pending",
    },
  });
  state.activeFeatureId = feature.id;
  state.fileChanges = [];
}

export async function persistAppServerEvent(
  event: AppServerEvent,
  state: PersistenceState,
  sandboxDir: string,
) {
  const method = event.method ?? event.type;

  if (method === "thread/started") {
    const threadId = getThreadId(event);
    if (!threadId) return;
    state.currentThreadId = threadId;
    await ensureThread(threadId, state.user);
    return;
  }

  if (method === "fileChange") {
    const diff = formatFileChange(event);
    if (diff) state.fileChanges.push(diff);
    return;
  }

  if (method === "turn/completed") {
    await completeFeature(event, state, sandboxDir);
    return;
  }

  if (method === "app-server-unavailable" || method === "bridge-request-timeout") {
    await failActiveFeature(event, state);
  }
}

async function ensureThread(threadId: string, user: PersistenceUser) {
  await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email, name: user.name, image: user.image },
    create: user,
  });

  await prisma.thread.upsert({
    where: { id: threadId },
    update: { userId: user.id },
    create: {
      id: threadId,
      userId: user.id,
      summary: "Codex session",
    },
  });
}

async function completeFeature(
  event: AppServerEvent,
  state: PersistenceState,
  sandboxDir: string,
) {
  if (!state.activeFeatureId || !state.currentThreadId) return;

  if (turnFailed(event)) {
    await prisma.feature.update({
      where: { id: state.activeFeatureId },
      data: {
        diff: turnErrorMessage(event),
        status: "failed",
      },
    });
    state.activeFeatureId = null;
    state.fileChanges = [];
    return;
  }

  const workingTreeDiff = gitDiff(sandboxDir);
  const diff = state.fileChanges.join("\n\n") || workingTreeDiff || null;
  await prisma.feature.update({
    where: { id: state.activeFeatureId },
    data: {
      diff,
      status: "applied",
    },
  });

  const turnId = sanitizeCommitSegment(getTurnId(event) ?? "unknown");
  const threadId = sanitizeCommitSegment(state.currentThreadId);
  try {
    execSync(
      `git add -A && git commit -m "turn:${turnId} thread:${threadId}"`,
      { cwd: sandboxDir },
    );
  } catch {
    // A turn may complete without file changes; persistence should still reflect completion.
  }

  state.activeFeatureId = null;
  state.fileChanges = [];
}

async function failActiveFeature(event: AppServerEvent, state: PersistenceState) {
  if (!state.activeFeatureId) return;

  await prisma.feature.update({
    where: { id: state.activeFeatureId },
    data: {
      diff: readString(event, "error") ?? "Request failed before completion.",
      status: "failed",
    },
  });
  state.activeFeatureId = null;
  state.fileChanges = [];
}

function gitDiff(sandboxDir: string) {
  try {
    return (
      execSync("git diff -- .", { cwd: sandboxDir, encoding: "utf8" }).trim() ||
      null
    );
  } catch {
    return null;
  }
}

function formatFileChange(event: AppServerEvent) {
  const path =
    readString(event, "path") ??
    readString(event, "filename") ??
    "changed file";
  const diff = readString(event, "diff");
  if (!diff) return path;
  return `${path}\n${diff}`;
}

function getThreadId(event: AppServerEvent) {
  const params = readObject(event, "params") ?? event;
  return (
    readString(params, "threadId") ??
    readString(params, "id") ??
    readNestedString(params, "thread", "id")
  );
}

function getTurnId(event: AppServerEvent) {
  const params = readObject(event, "params") ?? event;
  return (
    readString(params, "turnId") ??
    readString(params, "id") ??
    readNestedString(params, "turn", "id")
  );
}

function turnFailed(event: AppServerEvent) {
  const params = readObject(event, "params") ?? event;
  const turn = readObject(params, "turn");
  return turn ? readString(turn, "status") === "failed" : false;
}

function turnErrorMessage(event: AppServerEvent) {
  const params = readObject(event, "params") ?? event;
  const turn = readObject(params, "turn");
  const error = turn ? readObject(turn, "error") : null;
  return error ? readString(error, "message") : null;
}

function sanitizeCommitSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

function readObject(source: object, key: string) {
  if (!(key in source)) return null;
  const value = source[key as keyof typeof source];
  return value && typeof value === "object" ? value : null;
}

function readString(source: object, key: string) {
  if (!(key in source)) return null;
  const value = source[key as keyof typeof source];
  return typeof value === "string" ? value : null;
}

function readNestedString(source: object, objectKey: string, valueKey: string) {
  const nested = readObject(source, objectKey);
  return nested ? readString(nested, valueKey) : null;
}
