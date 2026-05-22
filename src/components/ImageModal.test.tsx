import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ImageModal } from "./ImageModal"

const product = {
  id: "prod_001",
  name: "Ceramic Pour-Over Coffee Set",
}

describe("ImageModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("renders product name and base image", () => {
    render(<ImageModal product={product} open onClose={vi.fn()} sandboxWindow={null} />)

    expect(screen.getByRole("heading", { name: "Ceramic Pour-Over Coffee Set" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Base Ceramic Pour-Over Coffee Set" })).toHaveAttribute(
      "src",
      "/images/prod_001-base.png",
    )
  })

  it("shows a placeholder before generation", () => {
    render(<ImageModal product={product} open onClose={vi.fn()} sandboxWindow={null} />)

    expect(screen.getByText("Generate to preview")).toBeInTheDocument()
  })

  it("generates and previews an image", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ url: "/images/prod_001-generated.png" })))
    render(<ImageModal product={product} open onClose={vi.fn()} sandboxWindow={null} />)

    await userEvent.type(screen.getByLabelText("Setting / mood"), "on a breakfast table")
    await userEvent.click(screen.getByRole("button", { name: "Generate" }))

    expect(await screen.findByRole("img", { name: "Generated Ceramic Pour-Over Coffee Set" })).toHaveAttribute(
      "src",
      "/images/prod_001-generated.png",
    )
  })

  it("shows an animated skeleton while generating", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)))
    render(<ImageModal product={product} open onClose={vi.fn()} sandboxWindow={null} />)

    await userEvent.click(screen.getByRole("button", { name: "Generate" }))

    expect(screen.getByTestId("image-generating-skeleton")).toBeInTheDocument()
  })

  it("shows moderation errors and keeps inputs intact", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "That prompt can't be used - please try different wording.", flagged: true }),
    }))
    render(<ImageModal product={product} open onClose={vi.fn()} sandboxWindow={null} />)

    const input = screen.getByLabelText("Setting / mood")
    await userEvent.type(input, "blocked context")
    await userEvent.click(screen.getByRole("button", { name: "Generate" }))

    expect(await screen.findByText("That prompt can't be used - please try different wording.")).toBeInTheDocument()
    expect(input).toHaveValue("blocked context")
  })

  it("posts useImage to the sandbox window", async () => {
    const sandboxWindow = { postMessage: vi.fn() } as unknown as Window
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ url: "/images/prod_001-generated.png" })))
    render(<ImageModal product={product} open onClose={vi.fn()} sandboxWindow={sandboxWindow} />)

    await userEvent.click(screen.getByRole("button", { name: "Generate" }))
    await userEvent.click(await screen.findByRole("button", { name: "Use this image" }))

    expect(sandboxWindow.postMessage).toHaveBeenCalledWith(
      { type: "useImage", productId: "prod_001", url: "/images/prod_001-generated.png" },
      "*",
    )
  })
})

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  }
}
