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
    vi.stubGlobal("fetch", createFetchMock("ok"))
  })

  it("keeps the sandbox iframe visible in the split workspace", async () => {
    render(<CatalogueWorkspace userName="Ada Lovelace" userEmail="ada@example.com" logoutAction={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "Manifest" })).toBeInTheDocument()
    expect(screen.getByText("cockpit")).toBeInTheDocument()
    expect(screen.getByTitle("Sandbox catalogue").getAttribute("src")).toMatch(/^http:\/\/localhost:3001\/\?__manifest_reload=\d+$/)
    expect(screen.getByText("Live sandbox")).toBeInTheDocument()
    expect(await screen.findByText("Catalogue online")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Refresh sandbox" })).toBeInTheDocument()
    expect(await screen.findByText("No sessions yet. Describe a feature to get started.")).toBeInTheDocument()
  })

  it("shows a sandbox unavailable overlay and checks again on refresh", async () => {
    const fetchMock = createFetchMock("down")
    vi.mocked(fetch).mockImplementation(fetchMock)
    render(<CatalogueWorkspace userName="Ada Lovelace" userEmail="ada@example.com" logoutAction={vi.fn()} />)

    expect(await screen.findAllByText("Sandbox unavailable")).toHaveLength(2)
    expect(screen.getByText("Sandbox is not reachable.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument()

    vi.mocked(fetch).mockImplementation(createFetchMock("ok"))
    await userEvent.click(screen.getByRole("button", { name: "Check again" }))

    expect(await screen.findByText("Catalogue online")).toBeInTheDocument()
  })

  it("shows composer, image studio, recovery, debug, and connection controls without switching tabs", async () => {
    render(<CatalogueWorkspace userName="Ada Lovelace" userEmail="ada@example.com" logoutAction={vi.fn()} />)

    expect(screen.getByPlaceholderText("Describe the catalogue change you want Codex to make...")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Submit feature request" })).toBeInTheDocument()
    expect(screen.getByText("App Server disconnected")).toBeInTheDocument()
    expect(screen.getByText("Image studio")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undo last change" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reset baseline" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Diagnostics/ })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("heading", { name: "Agent progress" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Debug inspection" })).not.toBeInTheDocument()
    expect(await screen.findByText("No sessions yet. Describe a feature to get started.")).toBeInTheDocument()
  })

  it("keeps diagnostics collapsed across the bottom until expanded", async () => {
    render(<CatalogueWorkspace userName="Ada Lovelace" userEmail="ada@example.com" logoutAction={vi.fn()} />)

    const diagnostics = screen.getByRole("button", { name: /Diagnostics/ })
    const threadHistory = screen.getByText("Threads")

    expect(diagnostics.compareDocumentPosition(threadHistory) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(screen.queryByText("No agent events yet.")).not.toBeInTheDocument()

    await userEvent.click(diagnostics)

    expect(diagnostics).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("heading", { name: "Agent progress" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Debug inspection" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Copy session log/ })).toBeInTheDocument()
    expect(screen.getByText("No agent progress events yet.")).toBeInTheDocument()
  })

  it("recovers the last applied thread after refresh and rolls it back", async () => {
    const fetchMock = createFetchMock("ok", {
      threads: [{ id: "thread_recovered", features: [{ id: "feature_1", status: "applied" }], _count: { features: 1 } }],
    })
    vi.mocked(fetch).mockImplementation(fetchMock)
    render(<CatalogueWorkspace userName="Ada Lovelace" userEmail="ada@example.com" logoutAction={vi.fn()} />)

    await screen.findByText("1 feature")
    expect(screen.getByRole("button", { name: "Undo last change" })).not.toBeDisabled()

    await userEvent.click(screen.getByRole("button", { name: "Undo last change" }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rollback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ threadId: "thread_recovered" }),
      }),
    )
  })

  it("shows a holding overlay while rollback is in progress", async () => {
    let resolveRollback: (value: Response) => void = () => {}
    const rollbackResponse = new Promise<Response>((resolve) => {
      resolveRollback = resolve
    })
    const fetchMock = createFetchMock("ok", {
      threads: [{ id: "thread_recovered", features: [{ id: "feature_1", status: "applied" }], _count: { features: 1 } }],
    })
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === "/api/rollback") return rollbackResponse
      return createFetchMock("ok", {
        threads: [{ id: "thread_recovered", features: [{ id: "feature_1", status: "applied" }], _count: { features: 1 } }],
      })(input)
    })
    vi.mocked(fetch).mockImplementation(fetchMock)
    render(<CatalogueWorkspace userName="Ada Lovelace" userEmail="ada@example.com" logoutAction={vi.fn()} />)

    await screen.findByText("1 feature")
    await userEvent.click(screen.getByRole("button", { name: "Undo last change" }))

    expect(screen.getByText("Updating sandbox")).toBeInTheDocument()
    expect(screen.getByText("Restoring previous sandbox state.")).toBeInTheDocument()

    resolveRollback({
      ok: true,
      json: async () => ({ message: "Rolled back to previous state" }),
    } as Response)

    expect(await screen.findByText("Restored")).toBeInTheDocument()
  })

  it("shows the signed-in user menu with logout in normal auth mode", async () => {
    render(<CatalogueWorkspace userName="Ada Lovelace" userEmail="ada@example.com" logoutAction={vi.fn()} />)

    const userMenu = screen.getByRole("button", { name: "Open user menu" })
    expect(userMenu).toHaveTextContent("Ada Lovelace")
    expect(screen.queryByText("Debug mode")).not.toBeInTheDocument()

    await userEvent.click(userMenu)

    expect(userMenu).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("ada@example.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument()
  })

  it("replaces the user dropdown with a debug mode indicator when debug auth is enabled", async () => {
    render(<CatalogueWorkspace userName="Dev User" userEmail="dev@localhost" debugAuthEnabled logoutAction={vi.fn()} />)

    expect(screen.getByText("Debug mode")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open user menu" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument()
    expect(screen.getByText("App Server disconnected")).toBeInTheDocument()
    expect(await screen.findByText("No sessions yet. Describe a feature to get started.")).toBeInTheDocument()
  })
})

function createFetchMock(sandboxStatus: "ok" | "down", threadPayload: { threads: unknown[] } = { threads: [] }) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === "/api/health") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          services: {
            sandbox: sandboxStatus === "ok"
              ? { status: "ok", message: "Sandbox is reachable." }
              : { status: "down", message: "Sandbox is not reachable." },
          },
        }),
      } as Response)
    }

    if (url === "/api/rollback") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ message: "Rolled back to previous state" }),
      } as Response)
    }

    return Promise.resolve({
      ok: true,
      json: async () => threadPayload,
    } as Response)
  })
}
