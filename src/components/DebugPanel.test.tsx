import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DebugPanel } from "./DebugPanel"
import type { AgentEvent } from "./AgentStream"

const events: AgentEvent[] = [
  { method: "thread/started", timestamp: "2026-05-23T00:00:00.000Z", params: { thread: { id: "thread_1" } } },
  { type: "fileChange", timestamp: "2026-05-23T00:00:01.000Z", path: "src/app/page.tsx", diff: "+ added\n- removed" },
  { method: "turn/completed", timestamp: "2026-05-23T00:00:02.000Z", params: { tokenUsage: { total: 42 } } },
]

describe("DebugPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it("renders known events as readable table rows", () => {
    render(<DebugPanel threadId="thread_1" events={events} onRollbackComplete={vi.fn()} onResetComplete={vi.fn()} />)

    expect(screen.getByText("thread_1")).toBeInTheDocument()
    expect(screen.getByText("42 tokens")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Time" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Event" })).toBeInTheDocument()
    expect(screen.getByText("Thread started")).toBeInTheDocument()
    expect(screen.getByText("File changed")).toBeInTheDocument()
    expect(screen.getByText("Turn completed")).toBeInTheDocument()
    expect(screen.getByText("Updated src/app/page.tsx")).toBeInTheDocument()
    expect(screen.queryByText(/"path": "src\/app\/page.tsx"/)).not.toBeInTheDocument()
  })

  it("keeps raw JSON hidden by default and visible when expanded", async () => {
    render(<DebugPanel threadId="thread_1" events={events} onRollbackComplete={vi.fn()} onResetComplete={vi.fn()} />)

    expect(screen.queryByText(/"path": "src\/app\/page.tsx"/)).not.toBeInTheDocument()

    await userEvent.click(screen.getAllByRole("button", { name: "View raw JSON" })[1])

    expect(screen.getByText(/"path": "src\/app\/page.tsx"/)).toBeInTheDocument()
  })

  it("keeps file diffs available and color-coded when expanded", async () => {
    render(<DebugPanel threadId="thread_1" events={events} onRollbackComplete={vi.fn()} onResetComplete={vi.fn()} />)

    await userEvent.click(screen.getByRole("button", { name: "View diff" }))

    expect(screen.getByText("+ added")).toHaveClass("text-emerald-400")
    expect(screen.getByText("- removed")).toHaveClass("text-rose-400")
    expect(screen.getByText(/"path": "src\/app\/page.tsx"/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "View diff" }))
    expect(screen.queryByText("+ added")).not.toBeInTheDocument()
  })

  it("copies the full session log", async () => {
    render(<DebugPanel threadId="thread_1" events={events} onRollbackComplete={vi.fn()} onResetComplete={vi.fn()} />)

    await userEvent.click(screen.getByRole("button", { name: /Copy session log/ }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(events, null, 2))
  })

  it("disables undo when there are no completed turns", () => {
    render(<DebugPanel threadId="thread_1" events={[]} onRollbackComplete={vi.fn()} onResetComplete={vi.fn()} />)

    expect(screen.getByRole("button", { name: "Undo last change" })).toBeDisabled()
  })

  it("calls rollback and shows a success message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Rolled back to previous state" })))
    const onRollbackComplete = vi.fn()
    render(<DebugPanel threadId="thread_1" events={events} onRollbackComplete={onRollbackComplete} onResetComplete={vi.fn()} />)

    await userEvent.click(screen.getByRole("button", { name: "Undo last change" }))

    expect(fetch).toHaveBeenCalledWith("/api/rollback", expect.objectContaining({ method: "POST" }))
    expect(await screen.findByText("Rolled back to previous state")).toBeInTheDocument()
    expect(onRollbackComplete).toHaveBeenCalled()
  })

  it("confirms reset and does not call the route when cancelled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "Sandbox reset to baseline" }))
    vi.stubGlobal("fetch", fetchMock)
    render(<DebugPanel threadId="thread_1" events={events} onRollbackComplete={vi.fn()} onResetComplete={vi.fn()} />)

    await userEvent.click(screen.getByRole("button", { name: "Reset baseline" }))
    expect(screen.getByText("This will discard all Codex changes and return the catalogue to its original state.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(fetchMock).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "Reset baseline" }))
    await userEvent.click(screen.getByRole("button", { name: "Confirm reset" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/reset", expect.objectContaining({ method: "POST" })))
    expect(await screen.findByText("Sandbox reset to baseline")).toBeInTheDocument()
  })
})

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  }
}
