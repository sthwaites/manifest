import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.hoisted(() => vi.fn())
const transcribeMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))

vi.mock("openai", () => ({
  default: vi.fn(() => ({
    audio: {
      transcriptions: {
        create: transcribeMock,
      },
    },
  })),
}))

describe("/api/transcribe", () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.mockReset()
    transcribeMock.mockReset()
  })

  it("returns a friendly error for audio that is too short", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    transcribeMock.mockRejectedValue({ code: "audio_too_short" })
    const { POST } = await import("./route")

    const response = await POST(requestWithAudio())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Record for at least one second before transcribing." })
  })

  it("returns transcribed text", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    transcribeMock.mockResolvedValue({ text: "on a marble counter" })
    const { POST } = await import("./route")

    const response = await POST(requestWithAudio())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ text: "on a marble counter" })
  })
})

function requestWithAudio() {
  const formData = new FormData()
  formData.set("audio", new File(["audio"], "prompt.webm", { type: "audio/webm" }))
  return {
    formData: async () => formData,
  } as Request
}
