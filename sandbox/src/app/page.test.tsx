import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SandboxHomePage from "./page"

describe("SandboxHomePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("loads persisted image overrides for standalone sandbox tabs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ prod_001: "/images/prod_001-generated.png" })))

    render(<SandboxHomePage />)

    expect(await screen.findByRole("img", { name: "Ceramic Pour-Over Coffee Set" })).toHaveAttribute(
      "src",
      "/images/prod_001-generated.png",
    )
  })

  it("polls image overrides so already-open sandbox tabs update", async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce(jsonResponse({ prod_001: "/images/prod_001-generated.png" }))
    vi.stubGlobal("fetch", fetchMock)

    render(<SandboxHomePage />)

    expect(screen.getByRole("img", { name: "Ceramic Pour-Over Coffee Set" })).toHaveAttribute("src", "/images/prod_001-base.png")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(screen.getByRole("img", { name: "Ceramic Pour-Over Coffee Set" })).toHaveAttribute(
      "src",
      "/images/prod_001-generated.png",
    )
  })

  it("still applies direct postMessage image updates immediately", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    render(<SandboxHomePage />)

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "useImage", productId: "prod_001", url: "/images/prod_001-message.png" },
        }),
      )
    })

    expect(screen.getByRole("img", { name: "Ceramic Pour-Over Coffee Set" })).toHaveAttribute("src", "/images/prod_001-message.png")
  })
})

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  }
}
