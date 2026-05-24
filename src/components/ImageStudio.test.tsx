import { fireEvent, render, screen } from "@testing-library/react"
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
    vi.unstubAllGlobals()
  })

  it("renders product selection, base image, prompt, and generation controls in the rail", () => {
    render(<ImageStudio products={products} sandboxWindow={null} />)

    expect(screen.getByRole("heading", { name: "Image studio" })).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toHaveValue("prod_001")
    expect(screen.getByRole("img", { name: "Base Ceramic Pour-Over Coffee Set" })).toHaveAttribute(
      "src",
      "/images/prod_001-base.png",
    )
    expect(screen.getByPlaceholderText("on a breakfast table")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Use this image" })).toBeDisabled()
  })

  it("resets the prompt and preview when selecting another product", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ url: "/images/prod_001-generated.png" })))
    render(<ImageStudio products={products} sandboxWindow={null} />)

    await userEvent.click(screen.getByRole("button", { name: "Generate" }))
    expect(await screen.findByRole("img", { name: "Generated Ceramic Pour-Over Coffee Set" })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole("combobox"), "prod_002")

    expect(screen.getByPlaceholderText("draped over a chair")).toHaveValue("")
    expect(screen.queryByRole("img", { name: "Generated Ceramic Pour-Over Coffee Set" })).not.toBeInTheDocument()
  })

  it("uses the product hint as the generation fallback when the prompt is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ url: "/images/prod_001-generated.png" }))
    vi.stubGlobal("fetch", fetchMock)
    render(<ImageStudio products={products} sandboxWindow={null} />)

    await userEvent.click(screen.getByRole("button", { name: "Generate" }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/images/generate",
      expect.objectContaining({
        body: JSON.stringify({
          productId: "prod_001",
          productName: "Ceramic Pour-Over Coffee Set",
          context: "on a breakfast table",
          style: "lifestyle",
        }),
      }),
    )
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

    const input = screen.getByPlaceholderText("on a breakfast table")
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

  it("transcribes microphone input into the image prompt", async () => {
    const stopTrack = vi.fn()
    const mediaRecorderInstances: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = []
    class MockMediaRecorder extends EventTarget {
      start = vi.fn()
      stop = vi.fn(() => {
        this.dispatchEvent(Object.assign(new Event("dataavailable"), { data: new Blob(["audio"], { type: "audio/webm" }) }))
        this.dispatchEvent(new Event("stop"))
      })

      constructor() {
        super()
        mediaRecorderInstances.push(this)
      }
    }
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      },
    })
    vi.stubGlobal("MediaRecorder", MockMediaRecorder)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "on a marble counter" }) }))

    render(<ImageStudio products={products} sandboxWindow={null} />)

    const micButton = await screen.findByRole("button", { name: "Record image prompt" })
    fireEvent.mouseDown(micButton)
    await screen.findByPlaceholderText("Listening...")
    fireEvent.mouseUp(micButton)

    expect(mediaRecorderInstances[0].start).toHaveBeenCalled()
    expect(mediaRecorderInstances[0].stop).toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalled()
    expect(await screen.findByDisplayValue("on a marble counter")).toBeInTheDocument()
  })
})

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    text: async () => JSON.stringify(body),
  }
}
