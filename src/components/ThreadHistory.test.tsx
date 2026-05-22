import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThreadHistory } from "./ThreadHistory"

describe("ThreadHistory", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("lists thread summaries and feature counts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ threads: [thread("thread_1", "Search work", 2)] })))

    render(<ThreadHistory onRollbackComplete={vi.fn()} />)

    expect(await screen.findByText("Search work")).toBeInTheDocument()
    expect(screen.getByText("2 features")).toBeInTheDocument()
  })

  it("renders the requested empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ threads: [] })))

    render(<ThreadHistory onRollbackComplete={vi.fn()} />)

    expect(await screen.findByText("No sessions yet. Describe a feature to get started.")).toBeInTheDocument()
  })

  it("calls rollback for a selected thread", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ threads: [thread("thread_1", "Search work", 1)] }))
      .mockResolvedValueOnce(jsonResponse({ message: "Rolled back to previous state" }))
      .mockResolvedValueOnce(jsonResponse({ threads: [thread("thread_1", "Search work", 1)] }))
    vi.stubGlobal("fetch", fetchMock)
    const onRollbackComplete = vi.fn()

    render(<ThreadHistory onRollbackComplete={onRollbackComplete} />)
    await userEvent.click(await screen.findByRole("button", { name: "Undo Search work" }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rollback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ threadId: "thread_1" }),
      }),
    )
    await waitFor(() => expect(onRollbackComplete).toHaveBeenCalled())
  })
})

function thread(id: string, summary: string, featureCount: number) {
  return {
    id,
    summary,
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
    _count: { features: featureCount },
  }
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  }
}
