import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CatalogueWorkspace } from "./CatalogueWorkspace"

class MockWebSocket extends EventTarget {
  static OPEN = 1
  readyState = MockWebSocket.OPEN
  close = vi.fn()
  send = vi.fn()
}

describe("CatalogueWorkspace", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal("WebSocket", MockWebSocket)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ threads: [] }),
      }),
    )
  })

  it("keeps the sandbox iframe visible in the split workspace", async () => {
    render(<CatalogueWorkspace />)

    expect(screen.getByTitle("Sandbox catalogue")).toHaveAttribute("src", "http://localhost:3001/")
    expect(screen.getByText("Live sandbox")).toBeInTheDocument()
    expect(screen.getByText("Catalogue visible")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Refresh sandbox" })).toBeInTheDocument()
    expect(await screen.findByText("No sessions yet. Describe a feature to get started.")).toBeInTheDocument()
  })

  it("shows composer, image studio, recovery, debug, and connection controls without switching tabs", async () => {
    render(<CatalogueWorkspace />)

    expect(screen.getByPlaceholderText("Describe a feature — it ships.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Submit feature request" })).toBeInTheDocument()
    expect(screen.getByText("App Server disconnected")).toBeInTheDocument()
    expect(screen.getByText("Image studio")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undo last change" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reset baseline" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Copy session log/ })).toBeInTheDocument()
    expect(screen.getByText("Debug inspection")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Agent progress/ })).toHaveAttribute("aria-expanded", "false")
    expect(await screen.findByText("No sessions yet. Describe a feature to get started.")).toBeInTheDocument()
  })

  it("keeps agent progress collapsed at the bottom until expanded", async () => {
    render(<CatalogueWorkspace />)

    const agentProgress = screen.getByRole("button", { name: /Agent progress/ })
    const debugInspection = screen.getByText("Debug inspection")

    expect(agentProgress.compareDocumentPosition(debugInspection) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(screen.queryByText("No agent events yet.")).not.toBeInTheDocument()

    await userEvent.click(agentProgress)

    expect(agentProgress).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("No agent events yet.")).toBeInTheDocument()
  })
})
