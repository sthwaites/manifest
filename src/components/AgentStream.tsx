"use client"

export type AgentEvent = {
  type?: string
  method?: string
  message?: string
  text?: string
  path?: string
  filename?: string
  status?: string
  command?: string
  exitCode?: number
  error?: string
  flagged?: boolean
  [key: string]: unknown
}

type AgentStreamProps = {
  events: AgentEvent[]
}

export function AgentStream({ events }: AgentStreamProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-400">
        No agent events yet.
      </div>
    )
  }

  const displayEvents = events.map((event, index) => ({ event, originalIndex: index })).reverse()

  return (
    <div className="space-y-3" aria-label="Agent events">
      {displayEvents.map(({ event, originalIndex }, displayIndex) => (
        <EventItem key={`${event.type ?? event.method ?? "event"}-${originalIndex}`} event={event} index={displayIndex} />
      ))}
    </div>
  )
}

function EventItem({ event, index }: { event: AgentEvent; index: number }) {
  const type = event.type ?? event.method ?? "event"
  const borderClass = getBorderClass(event)

  return (
    <article
      className={`translate-y-0 rounded-md border border-zinc-700 bg-zinc-900 p-3 text-sm opacity-100 transition duration-200 ease-out ${borderClass} ${getDelayClass(index)}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300">{type}</span>
        {event.status ? (
          <span className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium text-amber-400">{event.status}</span>
        ) : null}
      </div>
      <EventBody event={event} />
    </article>
  )
}

function EventBody({ event }: { event: AgentEvent }) {
  const type = event.type ?? event.method

  if (type === "agentMessage" || type === "reasoning") {
    return <p className="leading-6 text-zinc-100">{readableText(event)}</p>
  }

  if (type === "fileChange") {
    return (
      <div className="space-y-2">
        <p className="font-medium text-zinc-100">{event.path ?? event.filename ?? "Changed file"}</p>
        {typeof event.diff === "string" ? <pre className="overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-300">{event.diff}</pre> : null}
      </div>
    )
  }

  if (type === "commandExecution") {
    return (
      <div className="space-y-2">
        <code className="block overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-200">{event.command ?? "Command"}</code>
        {typeof event.exitCode === "number" ? <p className="text-xs text-zinc-400">exit {event.exitCode}</p> : null}
      </div>
    )
  }

  if (type === "plan" && Array.isArray(event.steps)) {
    return (
      <ol className="list-decimal space-y-1 pl-4 text-zinc-200">
        {event.steps.map((step, index) => (
          <li key={`${String(step)}-${index}`}>{String(step)}</li>
        ))}
      </ol>
    )
  }

  if (event.error || event.flagged) {
    return <p className="leading-6 text-rose-200">{event.error ?? "The request could not be completed."}</p>
  }

  return <pre className="overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-300">{JSON.stringify(event, null, 2)}</pre>
}

function readableText(event: AgentEvent) {
  return event.message ?? event.text ?? "Agent update"
}

function getBorderClass(event: AgentEvent) {
  const type = event.type ?? event.method

  if (event.error || event.flagged) return "border-l-2 border-l-rose-500"
  if (type === "fileChange") return "border-l-2 border-l-amber-400"
  if (type === "commandExecution") return "border-l-2 border-l-zinc-500"
  if (type === "turn/completed") return "border-l-2 border-l-emerald-500"
  if (type === "agentMessage" || type === "plan" || type === "reasoning") return "border-l-2 border-l-indigo-500"
  return "border-l-2 border-l-zinc-600"
}

function getDelayClass(index: number) {
  const delays = ["delay-0", "delay-75", "delay-100", "delay-150", "delay-200"]
  return delays[Math.min(index, delays.length - 1)]
}
