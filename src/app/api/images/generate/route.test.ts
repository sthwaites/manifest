import { beforeEach, describe, expect, it, vi } from "vitest"
import { ModerationError } from "@/lib/moderation"

const authMock = vi.hoisted(() => vi.fn())
const checkModerationMock = vi.hoisted(() => vi.fn())
const editMock = vi.hoisted(() => vi.fn())
const readFileMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))

vi.mock("@/lib/moderation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/moderation")>()
  return {
    ...actual,
    checkModeration: checkModerationMock,
  }
})

vi.mock("openai", () => ({
  default: vi.fn(() => ({
    images: {
      edit: editMock,
    },
  })),
  toFile: vi.fn(async (value: unknown) => value),
}))

vi.mock("fs/promises", () => ({
  default: { readFile: readFileMock, writeFile: writeFileMock },
  readFile: readFileMock,
  writeFile: writeFileMock,
}))

describe("/api/images/generate", () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.mockReset()
    checkModerationMock.mockReset()
    editMock.mockReset()
    readFileMock.mockReset()
    writeFileMock.mockReset()
  })

  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null)
    const { POST } = await import("./route")

    const response = await POST(request({}))

    expect(response.status).toBe(401)
  })

  it("returns 400 for malformed JSON", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/images/generate", {
        method: "POST",
        body: "{",
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." })
  })

  it("returns 400 when product fields are missing", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    const { POST } = await import("./route")

    const response = await POST(request({ productId: "prod_001" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "productId and productName are required" })
  })

  it("returns 400 when moderation flags context text", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    checkModerationMock.mockRejectedValue(new ModerationError("Content flagged: violence"))
    const { POST } = await import("./route")

    const response = await POST(request({ productId: "prod_001", productName: "Cup", context: "bad", style: "lifestyle" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "That prompt can't be used - please try different wording.",
      flagged: true,
    })
  })

  it("returns 502 when the moderation check fails unexpectedly", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    checkModerationMock.mockRejectedValue(new Error("network"))
    const { POST } = await import("./route")

    const response = await POST(request({ productId: "prod_001", productName: "Cup", context: "table" }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: "Prompt safety check failed. Try again." })
  })

  it("returns 404 when the base image is missing", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    checkModerationMock.mockResolvedValue(undefined)
    readFileMock.mockRejectedValue(new Error("not found"))
    const { POST } = await import("./route")

    const response = await POST(request({ productId: "prod_missing", productName: "Missing Product" }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Base product image was not found." })
  })

  it("returns 502 when the image service throws", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    checkModerationMock.mockResolvedValue(undefined)
    readFileMock.mockResolvedValue(Buffer.from("base image"))
    editMock.mockRejectedValue(new Error("service unavailable"))
    const { POST } = await import("./route")

    const response = await POST(request({ productId: "prod_001", productName: "Cup" }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: "Image generation service failed: service unavailable" })
  })

  it("returns 500 when the generated image cannot be saved", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    checkModerationMock.mockResolvedValue(undefined)
    readFileMock.mockResolvedValue(Buffer.from("base image"))
    editMock.mockResolvedValue({ data: [{ b64_json: Buffer.from("generated").toString("base64") }] })
    writeFileMock.mockRejectedValue(new Error("disk full"))
    const { POST } = await import("./route")

    const response = await POST(request({ productId: "prod_001", productName: "Cup" }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Generated image could not be saved." })
  })

  it("edits the base image, writes the generated file, and returns its URL", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    checkModerationMock.mockResolvedValue(undefined)
    readFileMock.mockResolvedValue(Buffer.from("base image"))
    editMock.mockResolvedValue({ data: [{ b64_json: Buffer.from("generated").toString("base64") }] })
    const { POST } = await import("./route")

    const response = await POST(
      request({
        productId: "prod_001",
        productName: "Ceramic Pour-Over Coffee Set",
        context: "on a breakfast table",
        style: "lifestyle",
      }),
    )

    expect(response.status).toBe(200)
    expect(checkModerationMock).toHaveBeenCalledWith("on a breakfast table lifestyle")
    expect(editMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-image-2",
      prompt: expect.stringContaining("Ceramic Pour-Over Coffee Set"),
    }))
    expect(writeFileMock).toHaveBeenCalled()
    const payload = await response.json()
    expect(payload.url).toMatch(/^\/images\/prod_001-\d+\.png$/)
    expect(payload.filename).toMatch(/^prod_001-\d+\.png$/)
  })
})

function request(body: unknown) {
  return new Request("http://localhost/api/images/generate", {
    method: "POST",
    body: JSON.stringify(body),
  })
}
