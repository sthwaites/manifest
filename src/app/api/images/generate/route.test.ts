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
