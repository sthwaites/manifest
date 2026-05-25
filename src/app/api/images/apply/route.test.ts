import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.hoisted(() => vi.fn())
const mkdirMock = vi.hoisted(() => vi.fn())
const readFileMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))

vi.mock("fs/promises", () => ({
  default: { mkdir: mkdirMock, readFile: readFileMock, writeFile: writeFileMock },
  mkdir: mkdirMock,
  readFile: readFileMock,
  writeFile: writeFileMock,
}))

describe("/api/images/apply", () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.mockReset()
    mkdirMock.mockReset()
    readFileMock.mockReset()
    writeFileMock.mockReset()
  })

  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null)
    const { POST } = await import("./route")

    const response = await POST(request({ productId: "prod_001", url: "/images/prod_001-123.png" }))

    expect(response.status).toBe(401)
  })

  it("rejects non-sandbox image urls", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    const { POST } = await import("./route")

    const response = await POST(request({ productId: "prod_001", url: "https://example.com/image.png" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Only sandbox image URLs can be applied." })
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it("writes merged image overrides for sandbox tabs", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    readFileMock.mockResolvedValue(JSON.stringify({ prod_002: "/images/prod_002-456.png" }))
    const { POST } = await import("./route")

    const response = await POST(request({ productId: "prod_001", url: "/images/prod_001-123.png" }))

    expect(response.status).toBe(200)
    expect(mkdirMock).toHaveBeenCalled()
    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining("image-overrides.json"),
      `${JSON.stringify({ prod_002: "/images/prod_002-456.png", prod_001: "/images/prod_001-123.png" }, null, 2)}\n`,
    )
    await expect(response.json()).resolves.toEqual({
      overrides: {
        prod_001: "/images/prod_001-123.png",
        prod_002: "/images/prod_002-456.png",
      },
    })
  })
})

function request(body: unknown) {
  return new Request("http://localhost/api/images/apply", {
    method: "POST",
    body: JSON.stringify(body),
  })
}
