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
    expect(screen.getByTitle("Sandbox catalogue")).toHaveAttribute("src", "http://localhost:3001/")
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
    expect(screen.getByRole("button", { name: /Copy session log/ })).toBeInTheDocument()
    expect(screen.getByText("Debug inspection")).toBeInTheDocument()
    expect(screen.getByText("Debug inspection").closest("section")).not.toHaveTextContent("Undo last change")
    expect(screen.getByText("Debug inspection").closest("section")).not.toHaveTextContent("Reset baseline")
    expect(screen.getByRole("button", { name: /Agent progress/ })).toHaveAttribute("aria-expanded", "false")
    expect(await screen.findByText("No sessions yet. Describe a feature to get started.")).toBeInTheDocument()
  })

  it("keeps agent progress collapsed at the bottom until expanded", async () => {
    render(<CatalogueWorkspace userName="Ada Lovelace" userEmail="ada@example.com" logoutAction={vi.fn()} />)

    const agentProgress = screen.getByRole("button", { name: /Agent progress/ })
    const debugInspection = screen.getByText("Debug inspection")

    expect(agentProgress.compareDocumentPosition(debugInspection) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(screen.queryByText("No agent events yet.")).not.toBeInTheDocument()

    await userEvent.click(agentProgress)

    expect(agentProgress).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("No agent events yet.")).toBeInTheDocument()
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

function createFetchMock(sandboxStatus: "ok" | "down") {
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

    return Promise.resolve({
      ok: true,
      json: async () => ({ threads: [] }),
    } as Response)
  })
}
