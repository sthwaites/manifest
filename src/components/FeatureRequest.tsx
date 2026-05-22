"use client"

import { Mic, Send } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { AgentEvent } from "./AgentStream"

type FeatureRequestProps = {
  onEvent: (event: AgentEvent) => void
  onConnectionChange?: (connected: boolean) => void
}

export function FeatureRequest({ onEvent, onConnectionChange }: FeatureRequestProps) {
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [supportsRecording, setSupportsRecording] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [appServerUnavailable, setAppServerUnavailable] = useState(false)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const socketRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    setSupportsRecording(typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices))

    const protocol = window.location.protocol === "https:" ? "wss" : "ws"
    const primaryUrl = `${protocol}://${window.location.host}/api/ws`
    const fallbackUrl =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? `${protocol}://${window.location.hostname}:3002/api/ws`
        : null
    let fallbackStarted = false
    let socket = connect(primaryUrl)

    function connect(url: string) {
      const nextSocket = new WebSocket(url)
      socketRef.current = nextSocket
      nextSocket.addEventListener("open", () => {
        setAppServerUnavailable(false)
        onConnectionChange?.(true)
      })
      nextSocket.addEventListener("close", () => {
        onConnectionChange?.(false)
        if (!fallbackStarted && fallbackUrl && url === primaryUrl) {
          fallbackStarted = true
          socket = connect(fallbackUrl)
        }
      })
      nextSocket.addEventListener("message", (message) => {
        const event = parseEvent(message.data)
        if (!event) return
        setSubmitting(false)
        if (event.type === "app-server-unavailable") {
          setAppServerUnavailable(true)
        }
        if (event.flagged || event.error) {
          setError(event.flagged ? "That prompt can't be used — please try different wording." : event.error ?? "The request could not be completed.")
        }
        onEvent(event)
      })
      return nextSocket
    }

    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [connectionAttempt, onConnectionChange, onEvent])

  function submitFeature() {
    const text = input.trim()
    if (!text) return
    setError(null)

    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setError("App Server not running. Check the local Codex process and try again.")
      setAppServerUnavailable(true)
      return
    }

    setSubmitting(true)
    socketRef.current.send(JSON.stringify({ type: "featureRequest", text }))
    onEvent({ type: "agentMessage", message: text })
    setInput("")
  }

  async function startRecording() {
    if (!supportsRecording || recording) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorderRef.current = recorder
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      })
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop())
        void transcribeRecording()
      })
      recorder.start()
      setRecording(true)
    } catch {
      setError("Microphone access was not available.")
    }
  }

  function stopRecording() {
    if (!recording) return
    setRecording(false)
    recorderRef.current?.stop()
  }

  async function transcribeRecording() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" })
    if (blob.size === 0) return

    setTranscribing(true)
    try {
      const formData = new FormData()
      formData.set("audio", blob, "request.webm")
      const response = await fetch("/api/transcribe", { method: "POST", body: formData })
      const payload = (await response.json()) as { text?: string; error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Transcription failed")
      setInput(payload.text ?? "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed")
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <div className="space-y-3">
      {appServerUnavailable ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-400 bg-zinc-950 px-3 py-2 text-sm text-amber-400">
          <span>App Server not running.</span>
          <button type="button" onClick={() => setConnectionAttempt((value) => value + 1)} className="text-xs font-medium text-zinc-50 transition hover:text-amber-200">
            Reconnect
          </button>
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitFeature()
          }}
          disabled={submitting}
          placeholder={recording ? "Listening..." : "Describe a feature — it ships."}
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500 disabled:opacity-60"
        />
        {supportsRecording ? (
          <button
            type="button"
            aria-label="Record feature request"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`grid size-10 place-items-center rounded-md border border-zinc-700 transition ${
              recording ? "border-rose-500 text-rose-500 animate-pulse" : "text-zinc-400 hover:text-zinc-200"
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
      {transcribing ? <p className="text-sm text-zinc-400">Transcribing...</p> : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </div>
  )
}

function parseEvent(data: string | ArrayBufferLike | Blob | ArrayBufferView): AgentEvent | null {
  if (typeof data !== "string") return null

  try {
    return JSON.parse(data) as AgentEvent
  } catch {
    return { type: "debug", message: data }
  }
}
