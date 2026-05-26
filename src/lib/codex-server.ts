import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import * as readline from "node:readline";
import { eventBus, type AppServerEvent } from "./event-bus";

export type AppServerClient = {
  send: (message: unknown) => boolean;
  process: ChildProcessWithoutNullStreams;
  generation: number;
};

let proc: ChildProcessWithoutNullStreams | null = null;
let client: AppServerClient | null = null;
let nextMessageId = 1;
let lastUnavailableMessage: string | null = null;
let appServerGeneration = 0;

export function startAppServer(sandboxDir: string): AppServerClient {
  if (client && proc && !proc.killed) {
    return client;
  }

  try {
    lastUnavailableMessage = null;
    appServerGeneration += 1;
    proc = spawn(
      "codex",
      [
        "app-server",
        "-c",
        'approval_policy="never"',
        "-c",
        'sandbox_mode="danger-full-access"',
      ],
      {
        cwd: sandboxDir,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          CODEX_API_KEY:
            process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY,
          GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || "Manifest Agent",
          GIT_AUTHOR_EMAIL:
            process.env.GIT_AUTHOR_EMAIL || "manifest-agent@example.invalid",
          GIT_COMMITTER_NAME:
            process.env.GIT_COMMITTER_NAME || "Manifest Agent",
          GIT_COMMITTER_EMAIL:
            process.env.GIT_COMMITTER_EMAIL || "manifest-agent@example.invalid",
        },
      },
    );
  } catch (error) {
    emitUnavailable(error);
    throw error;
  }

  const generation = appServerGeneration;
  const rl = readline.createInterface({ input: proc.stdout });
  rl.on("line", (line) => {
    try {
      const message = {
        ...(JSON.parse(line) as AppServerEvent),
        appServerGeneration: generation,
      };
      // Bridge raw App Server events to WebSocket subscribers without coupling UI code to stdio.
      eventBus.emit("app-server-event", message);
    } catch {
      eventBus.emit("debug-event", {
        type: "malformed-app-server-event",
        line,
      });
    }
  });

  proc.on("error", (error) => {
    if (generation !== appServerGeneration) return;
    emitUnavailable(error);
  });
  proc.on("exit", (code, signal) => {
    if (generation !== appServerGeneration) return;
    stopProcessGroup(proc);
    lastUnavailableMessage = "App-server exited before the request finished.";
    eventBus.emit("debug-event", { type: "app-server-exit", code, signal });
    eventBus.emit("app-server-event", {
      type: "app-server-unavailable",
      error: lastUnavailableMessage,
      code,
      signal,
      appServerGeneration: generation,
    });
    proc = null;
    client = null;
  });

  client = {
    process: proc,
    generation,
    send(message: unknown) {
      if (!proc || proc.killed) {
        emitUnavailable();
        return false;
      }
      try {
        const writable = proc.stdin.write(
          `${JSON.stringify(message)}\n`,
          (error?: Error | null) => {
            if (error) emitUnavailable(error);
          },
        );
        if (!writable && proc.stdin.destroyed) {
          emitUnavailable(new Error("App-server stdin closed"));
          return false;
        }
        return true;
      } catch (error) {
        emitUnavailable(error);
        return false;
      }
    },
  };

  initializeAppServer(client);
  return client;
}

export function restartAppServer(sandboxDir: string): AppServerClient {
  if (proc && !proc.killed) {
    stopProcessGroup(proc);
  }
  proc = null;
  client = null;
  return startAppServer(sandboxDir);
}

export function getAppServerClient() {
  return client;
}

export function getAppServerStatus() {
  if (client && proc && !proc.killed) {
    return { status: "ok" as const, message: "App-server process is running." };
  }

  return {
    status: lastUnavailableMessage ? ("down" as const) : ("unknown" as const),
    message: lastUnavailableMessage ?? "App-server has not started yet.",
  };
}

export function createThreadStartMessage() {
  return {
    method: "thread/start",
    id: nextMessageId++,
    params: {
      model: "gpt-5.5",
      ephemeral: false,
    },
  };
}

export function createTurnStartMessage(
  threadId: string,
  input: string,
  sandboxDir: string,
) {
  return {
    method: "turn/start",
    id: nextMessageId++,
    params: {
      threadId,
      input: [{ type: "text", text: input }],
      sandboxPolicy: {
        type: "dangerFullAccess",
      },
      approvalPolicy: "never",
      cwd: sandboxDir,
    },
  };
}

function initializeAppServer(appServerClient: AppServerClient) {
  const apiKey = process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY;

  appServerClient.send({
    method: "initialize",
    id: nextMessageId++,
    params: {
      clientInfo: {
        name: "manifest",
        version: "0.1.0",
      },
      capabilities: {
        optOutNotificationMethods: [],
      },
    },
  });
  appServerClient.send({
    method: "initialized",
    params: {},
  });
  if (apiKey) {
    appServerClient.send({
      method: "account/login/start",
      id: nextMessageId++,
      params: {
        type: "apiKey",
        apiKey,
      },
    });
  }
}

function stopProcessGroup(child: ChildProcessWithoutNullStreams | null) {
  if (!child || child.killed) return;
  try {
    if (process.platform !== "win32" && child.pid) {
      process.kill(-child.pid, "SIGTERM");
      return;
    }
    child.kill("SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // The process may have already exited.
    }
  }
}

function emitUnavailable(error?: unknown) {
  lastUnavailableMessage =
    error instanceof Error ? error.message : "App-server unavailable.";
  eventBus.emit("app-server-event", {
    type: "app-server-unavailable",
    error: lastUnavailableMessage,
    appServerGeneration,
  });
}
