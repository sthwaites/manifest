import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const getThreadEventsMock = vi.fn()

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))

vi.mock("@/lib/event-log", () => ({
  getThreadEvents: getThreadEventsMock,
}))

describe("/api/threads/[id]/events", () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.mockReset()
    getThreadEventsMock.mockReset()
  })

  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null)
    const { GET } = await import("./route")

    const response = await GET(new Request("http://localhost/api/threads/thread_1/events"), { params: Promise.resolve({ id: "thread_1" }) })

    expect(response.status).toBe(401)
  })

  it("returns events for an authenticated session", async () => {
    authMock.mockResolvedValue({ user: { id: "debug-user" } })
    getThreadEventsMock.mockReturnValue([{ method: "thread/started" }])
    const { GET } = await import("./route")

    const response = await GET(new Request("http://localhost/api/threads/thread_1/events"), { params: Promise.resolve({ id: "thread_1" }) })

    expect(response.status).toBe(200)
    expect(getThreadEventsMock).toHaveBeenCalledWith("thread_1")
    await expect(response.json()).resolves.toEqual({ events: [{ method: "thread/started" }] })
  })
})
