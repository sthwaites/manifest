"use client";

import { Mic, RotateCcw, RotateCw, Send, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent } from "./AgentStream";

type FeatureRequestProps = {
  onEvent: (event: AgentEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
  threadId: string | null;
  events: AgentEvent[];
  onRollbackComplete?: () => void;
  onResetComplete?: () => void;
};

type ConnectionState = "disconnected" | "connecting" | "connected";
type ProgressStage =
  | "idle"
  | "sending"
  | "starting"
  | "working"
  | "applying"
  | "applied"
  | "failed";

const THREAD_START_TIMEOUT_MS = 30_000;
const AGENT_ACTIVITY_TIMEOUT_MS = 120_000;

export function FeatureRequest({
  onEvent,
  onConnectionChange,
  threadId,
  events,
  onRollbackComplete,
  onResetComplete,
}: FeatureRequestProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [supportsRecording, setSupportsRecording] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<ProgressStage>("idle");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [requestFailure, setRequestFailure] = useState<
    | "bridge-disconnected"
    | "connection-lost"
    | "app-server-unavailable"
    | "timeout"
    | "moderation"
    | "agent-failed"
    | null
  >(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastSubmittedPromptRef = useRef<string | null>(null);
  const threadStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const agentActivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const suppressNextCloseRef = useRef(false);
  const submittingRef = useRef(false);
  const hasCompletedTurn = events.some(
    (event) => (event.method ?? event.type) === "turn/completed",
  );
  const showConnectionBanner =
    connectionState !== "connected" || requestFailure !== null;

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  const clearRequestTimers = useCallback(() => {
    if (threadStartTimerRef.current) clearTimeout(threadStartTimerRef.current);
    if (agentActivityTimerRef.current)
      clearTimeout(agentActivityTimerRef.current);
    threadStartTimerRef.current = null;
    agentActivityTimerRef.current = null;
  }, []);

  const failRequest = useCallback(
    (
      message: string,
      failure: NonNullable<typeof requestFailure>,
      restorePrompt = true,
    ) => {
      clearRequestTimers();
      setError(message);
      setRequestFailure(failure);
      setSubmitting(false);
      setProgress("failed");
      if (restorePrompt && lastSubmittedPromptRef.current) {
        setInput(
          (current) => current || (lastSubmittedPromptRef.current ?? ""),
        );
      }
    },
    [clearRequestTimers],
  );

  const startAgentTimeout = useCallback(() => {
    if (agentActivityTimerRef.current)
      clearTimeout(agentActivityTimerRef.current);
    agentActivityTimerRef.current = setTimeout(() => {
      failRequest(
        "The agent stopped responding before the request finished. Reconnect and send again.",
        "timeout",
      );
    }, AGENT_ACTIVITY_TIMEOUT_MS);
  }, [failRequest]);

  const resetRequestState = useCallback(() => {
    clearRequestTimers();
    setSubmitting(false);
    setProgress("idle");
    setRequestFailure(null);
    setError(null);
  }, [clearRequestTimers]);

  useEffect(() => {
    setSupportsRecording(
      typeof window !== "undefined" &&
        "MediaRecorder" in window &&
        Boolean(navigator.mediaDevices),
    );

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const localHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const primaryUrl = localHost
      ? `${protocol}://${window.location.hostname}:3002/api/ws`
      : `${protocol}://${window.location.host}/api/ws`;
    const socket = connect(primaryUrl);

    function connect(url: string) {
      setConnectionState("connecting");
      const nextSocket = new WebSocket(url);
      socketRef.current = nextSocket;
      nextSocket.addEventListener("open", () => {
        setConnectionState("connected");
        onConnectionChange?.(true);
      });
      nextSocket.addEventListener("close", () => {
        setConnectionState("disconnected");
        onConnectionChange?.(false);
        if (suppressNextCloseRef.current) {
          suppressNextCloseRef.current = false;
          return;
        }
        if (lastSubmittedPromptRef.current && submittingRef.current) {
          failRequest(
            "Connection lost before the request finished. Reconnect and send again.",
            "connection-lost",
          );
        }
      });
      nextSocket.addEventListener("error", () => {
        setConnectionState("disconnected");
        onConnectionChange?.(false);
        if (lastSubmittedPromptRef.current && submittingRef.current) {
          failRequest(
            "Connection lost before the request finished. Reconnect and send again.",
            "connection-lost",
          );
        }
      });
      nextSocket.addEventListener("message", (message) => {
        const event = parseEvent(message.data);
        if (!event) return;
        const eventType = event.method ?? event.type;

        const turnFailure =
          eventType === "turn/completed" ? turnFailureMessage(event) : null;
        const nonRetryableError =
          eventType === "error" ? eventFailureMessage(event) : null;

        if (eventType === "app-server-unavailable") {
          failRequest(
            event.error ??
              event.message ??
              "App-server unavailable. Reconnect and send again.",
            "app-server-unavailable",
          );
        } else if (eventType === "bridge-request-timeout") {
          failRequest(
            event.error ??
              "The request timed out before the agent started. Reconnect and send again.",
            "timeout",
          );
        } else if (event.flagged) {
          failRequest(
            "That prompt can't be used — please try different wording.",
            "moderation",
          );
        } else if (turnFailure) {
          failRequest(turnFailure, "agent-failed");
        } else if (nonRetryableError) {
          failRequest(nonRetryableError, "agent-failed");
        } else if (event.error) {
          failRequest(event.error, "agent-failed");
        } else {
          if (eventType === "thread/started") {
            if (threadStartTimerRef.current)
              clearTimeout(threadStartTimerRef.current);
            threadStartTimerRef.current = null;
            startAgentTimeout();
          } else if (eventType === "turn/completed") {
            clearRequestTimers();
            lastSubmittedPromptRef.current = null;
            setRequestFailure(null);
            setSubmitting(false);
          } else if (lastSubmittedPromptRef.current && isAgentActivity(event)) {
            startAgentTimeout();
          }
          setProgress((current) => nextProgress(current, event));
        }
        onEvent(event);
      });
      return nextSocket;
    }

    return () => {
      clearRequestTimers();
      suppressNextCloseRef.current = true;
      socket.close();
      socketRef.current = null;
    };
  }, [
    clearRequestTimers,
    connectionAttempt,
    failRequest,
    onConnectionChange,
    onEvent,
    startAgentTimeout,
  ]);

  const sendFeatureRequest = useCallback(
    (text: string) => {
      if (!text) return;
      setError(null);
      setRequestFailure(null);

      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        lastSubmittedPromptRef.current = text;
        setInput(text);
        failRequest(
          "Bridge disconnected. Reconnect and send again.",
          "bridge-disconnected",
        );
        return;
      }

      clearRequestTimers();
      lastSubmittedPromptRef.current = text;
      setSubmitting(true);
      setProgress("sending");
      socketRef.current.send(JSON.stringify({ type: "featureRequest", text }));
      onEvent({ type: "agentMessage", message: text });
      setInput("");
      if (threadId) {
        startAgentTimeout();
      } else {
        threadStartTimerRef.current = setTimeout(() => {
          failRequest(
            "The request timed out before the agent started. Reconnect and send again.",
            "timeout",
          );
        }, THREAD_START_TIMEOUT_MS);
      }
    },
    [clearRequestTimers, failRequest, onEvent, startAgentTimeout, threadId],
  );

  function submitFeature() {
    sendFeatureRequest(input.trim());
  }

  function retryLastPrompt() {
    const prompt = lastSubmittedPromptRef.current ?? input.trim();
    sendFeatureRequest(prompt);
  }

  function reconnect() {
    clearRequestTimers();
    setSubmitting(false);
    setProgress("idle");
    suppressNextCloseRef.current = true;
    socketRef.current?.close();
    setConnectionAttempt((value) => value + 1);
  }

  async function rollback() {
    if (!threadId) return;
    setToast(null);
    setError(null);
    const response = await fetch("/api/rollback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId }),
    });
    const payload = (await response.json()) as {
      message?: string;
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Rollback failed");
      return;
    }
    setToast(payload.message ?? "Rolled back to previous state");
    onRollbackComplete?.();
  }

  async function reset() {
    setToast(null);
    setError(null);
    const response = await fetch("/api/reset", { method: "POST" });
    const payload = (await response.json()) as {
      message?: string;
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Reset failed");
      return;
    }
    setToast(payload.message ?? "Sandbox reset to baseline");
    setConfirmingReset(false);
    lastSubmittedPromptRef.current = null;
    resetRequestState();
    onResetComplete?.();
  }

  async function startRecording() {
    if (!supportsRecording || recording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop());
        void transcribeRecording();
      });
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access was not available.");
    }
  }

  function stopRecording() {
    if (!recording) return;
    setRecording(false);
    recorderRef.current?.stop();
  }

  async function transcribeRecording() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size === 0) return;

    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.set("audio", blob, "request.webm");
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        text?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Transcription failed");
      setInput(payload.text ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div className="space-y-4">
      {showConnectionBanner ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-400 bg-zinc-950 px-3 py-2 text-sm text-amber-400">
          <span>{connectionMessage(connectionState, requestFailure)}</span>
          <button
            type="button"
            onClick={reconnect}
            className="text-xs font-medium text-zinc-50 transition hover:text-amber-200"
          >
            Reconnect
          </button>
        </div>
      ) : null}
      <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3 transition focus-within:border-indigo-500">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
              submitFeature();
          }}
          disabled={submitting}
          rows={5}
          placeholder={
            recording
              ? "Listening..."
              : "Describe the catalogue change you want Codex to make..."
          }
          className="min-h-32 w-full resize-none bg-transparent text-sm leading-6 text-zinc-50 outline-none placeholder:text-zinc-500 disabled:opacity-60"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-zinc-500">
            {transcribing ? "Transcribing..." : "Cmd/Ctrl + Enter"}
          </div>
          <div className="flex items-center gap-2">
            {supportsRecording ? (
              <button
                type="button"
                aria-label="Record feature request"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`grid size-10 place-items-center rounded-md border border-zinc-700 transition ${
                  recording
                    ? "animate-pulse border-rose-500 text-rose-500"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Mic className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Submit feature request"
              onClick={submitFeature}
              disabled={submitting}
              className={`grid size-10 place-items-center rounded-md bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-60 ${submitting ? "animate-pulse" : ""}`}
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <ProgressMeter stage={progress} />
      {requestFailure && lastSubmittedPromptRef.current ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
          <span className="truncate">Request preserved.</span>
          <button
            type="button"
            onClick={retryLastPrompt}
            disabled={connectionState !== "connected" || submitting}
            className="font-medium text-indigo-300 transition hover:text-indigo-200 disabled:text-zinc-600"
          >
            Retry
          </button>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void rollback()}
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
      </div>
      {toast ? <p className="text-sm text-emerald-400">{toast}</p> : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {confirmingReset ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/80 px-4">
          <section className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-5">
            <h3 className="text-base font-semibold">Reset to baseline</h3>
            <p className="mt-2 text-sm text-zinc-300">
              This will discard all Codex changes and return the catalogue to
              its original state.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="h-9 rounded-md border border-zinc-700 px-3 text-sm text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void reset()}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-orange-500 px-3 text-sm font-medium text-white"
              >
                <RotateCw className="size-4" />
                Confirm reset
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

const progressStages: Array<{ id: ProgressStage; label: string }> = [
  { id: "sending", label: "Sending" },
  { id: "starting", label: "Starting agent" },
  { id: "working", label: "Agent working" },
  { id: "applying", label: "Applying changes" },
  { id: "applied", label: "Applied" },
];

function connectionMessage(
  connectionState: ConnectionState,
  failure: string | null,
) {
  if (failure === "app-server-unavailable") return "App-server unavailable.";
  if (failure === "timeout") return "Request timed out.";
  if (failure === "moderation") return "Prompt blocked by moderation.";
  if (failure === "agent-failed") return "Agent failed before finishing.";
  if (failure === "connection-lost") return "Bridge connection lost.";
  if (connectionState === "connecting") return "Bridge connecting.";
  return "Bridge disconnected.";
}

function isAgentActivity(event: AgentEvent) {
  const type = event.method ?? event.type;
  return (
    type === "commandExecution" ||
    type === "reasoning" ||
    type === "agentMessage" ||
    type === "fileChange"
  );
}

function ProgressMeter({ stage }: { stage: ProgressStage }) {
  if (stage === "idle") return null;
  if (stage === "failed")
    return <p className="text-xs font-medium text-rose-400">Failed</p>;

  const activeIndex = progressStages.findIndex((item) => item.id === stage);
  return (
    <ol className="grid grid-cols-5 gap-1 text-[11px] font-medium">
      {progressStages.map((item, index) => {
        const active = index === activeIndex;
        const complete = activeIndex > index;
        return (
          <li
            key={item.id}
            aria-current={active ? "step" : undefined}
            className={`truncate rounded border px-2 py-1 text-center ${
              active || complete
                ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-200"
                : "border-zinc-800 text-zinc-600"
            }`}
          >
            {item.label}
          </li>
        );
      })}
    </ol>
  );
}

function nextProgress(
  current: ProgressStage,
  event: AgentEvent,
): ProgressStage {
  const type = event.method ?? event.type;
  if (type === "app-server-unavailable") return "failed";
  if (type === "turn/completed")
    return turnFailureMessage(event) ? "failed" : "applied";
  if (type === "fileChange") return "applying";
  if (
    type === "commandExecution" ||
    type === "reasoning" ||
    type === "agentMessage"
  )
    return "working";
  if (type === "thread/started") return "starting";
  return current === "sending" ? "starting" : current;
}

function eventFailureMessage(event: AgentEvent) {
  const params = readRecord(event.params);
  if ((params?.willRetry ?? event.willRetry) !== false) return null;
  const error = readRecord(params?.error);
  return (
    readString(error?.message) ??
    readString(params?.message) ??
    "Agent failed before finishing. Reconnect and send again."
  );
}

function turnFailureMessage(event: AgentEvent) {
  const params = readRecord(event.params);
  const turn = readRecord(params?.turn) ?? readRecord(event.turn);
  if (readString(turn?.status) !== "failed") return null;
  const error = readRecord(turn?.error);
  return (
    readString(error?.message) ??
    "Agent failed before finishing. Reconnect and send again."
  );
}

function readRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseEvent(
  data: string | ArrayBufferLike | Blob | ArrayBufferView,
): AgentEvent | null {
  if (typeof data !== "string") return null;

  try {
    return JSON.parse(data) as AgentEvent;
  } catch {
    return { type: "debug", message: data };
  }
}
