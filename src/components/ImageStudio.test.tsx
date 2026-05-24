import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ImageStudio } from "./ImageStudio"

const products = [
  {
    id: "prod_001",
    name: "Ceramic Pour-Over Coffee Set",
    category: "Kitchen",
    imagePromptHint: "on a breakfast table",
  },
  {
    id: "prod_002",
    name: "Merino Wool Throw Blanket",
    category: "Home",
    imagePromptHint: "draped over a chair",
  },
]

describe("ImageStudio", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("renders product selection, base image, prompt, and generation controls in the rail", () => {
    render(<ImageStudio products={products} sandboxWindow={null} />)

    expect(screen.getByRole("heading", { name: "Image studio" })).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toHaveValue("prod_001")
    expect(screen.getByRole("img", { name: "Base Ceramic Pour-Over Coffee Set" })).toHaveAttribute(
      "src",
      "/images/prod_001-base.png",
    )
    expect(screen.getByDisplayValue("on a breakfast table")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Use this image" })).toBeDisabled()
  })

  it("resets the prompt and preview when selecting another product", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ url: "/images/prod_001-generated.png" })))
    render(<ImageStudio products={products} sandboxWindow={null} />)

    await userEvent.click(screen.getByRole("button", { name: "Generate" }))
    expect(await screen.findByRole("img", { name: "Generated Ceramic Pour-Over Coffee Set" })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole("combobox"), "prod_002")

    expect(screen.getByDisplayValue("draped over a chair")).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: "Generated Ceramic Pour-Over Coffee Set" })).not.toBeInTheDocument()
  })

  it("generates, previews, and applies an image to the sandbox window", async () => {
    const sandboxWindow = { postMessage: vi.fn() } as unknown as Window
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ url: "/images/prod_001-generated.png" })))
    render(<ImageStudio products={products} sandboxWindow={sandboxWindow} />)

    await userEvent.click(screen.getByRole("button", { name: "Generate" }))

    expect(await screen.findByRole("img", { name: "Generated Ceramic Pour-Over Coffee Set" })).toHaveAttribute(
      "src",
      "/images/prod_001-generated.png",
    )
    expect(screen.getByText("Image ready. Apply it to update the preview.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Use this image" }))

    expect(sandboxWindow.postMessage).toHaveBeenCalledWith(
      { type: "useImage", productId: "prod_001", url: "/images/prod_001-generated.png" },
      "*",
    )
  })

  it("shows an animated status while generating", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)))
    render(<ImageStudio products={products} sandboxWindow={null} />)

    await userEvent.click(screen.getByRole("button", { name: "Generate" }))

    expect(screen.getByTestId("image-generating-skeleton")).toHaveTextContent("Generating image")
  })

  it("shows moderation errors and keeps inputs intact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "That prompt can't be used - please try different wording.", flagged: true }, false)),
    )
    render(<ImageStudio products={products} sandboxWindow={null} />)

    const input = screen.getByDisplayValue("on a breakfast table")
    await userEvent.clear(input)
    await userEvent.type(input, "blocked context")
    await userEvent.click(screen.getByRole("button", { name: "Generate" }))

    expect(await screen.findByText("That prompt can't be used - please try different wording.")).toBeInTheDocument()
    expect(input).toHaveValue("blocked context")
  })

  it("shows a friendly error for empty API responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "",
      }),
    )
    render(<ImageStudio products={products} sandboxWindow={null} />)

    await userEvent.click(screen.getByRole("button", { name: "Generate" }))

    expect(await screen.findByText("Image generation failed with an empty response.")).toBeInTheDocument()
  })

  it("shows a friendly error for unreadable API responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "<html>Error</html>",
      }),
    )
    render(<ImageStudio products={products} sandboxWindow={null} />)

    await userEvent.click(screen.getByRole("button", { name: "Generate" }))

    expect(await screen.findByText("Image generation failed with an unreadable response.")).toBeInTheDocument()
  })
})

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    text: async () => JSON.stringify(body),
  }
}
