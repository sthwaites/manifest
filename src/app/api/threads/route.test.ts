import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const prismaMock = vi.hoisted(() => ({
  thread: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  user: {
    upsert: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

describe("/api/threads", () => {
  beforeEach(() => {
    vi.resetModules()
    authMock.mockReset()
    prismaMock.thread.findMany.mockReset()
    prismaMock.thread.create.mockReset()
    prismaMock.user.upsert.mockReset()
  })

  it("returns 401 for unauthenticated GET", async () => {
    authMock.mockResolvedValue(null)
    const { GET } = await import("./route")

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it("returns only threads with active features for authenticated GET", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1", email: "dev@localhost" } })
    prismaMock.thread.findMany.mockResolvedValue([
      { id: "thread_1", features: [{ id: "feature_1", status: "applied" }, { id: "feature_2", status: "pending" }] },
    ])
    const { GET } = await import("./route")

    const response = await GET()

    expect(response.status).toBe(200)
    expect(prismaMock.thread.findMany).toHaveBeenCalledWith(
      {
        where: {
          userId: "user_1",
          features: {
            some: { status: { in: ["pending", "applied"] } },
          },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          features: {
            where: { status: { in: ["pending", "applied"] } },
            select: { id: true, status: true },
          },
        },
      },
    )
    await expect(response.json()).resolves.toEqual({
      threads: [
        {
          id: "thread_1",
          features: [{ id: "feature_1", status: "applied" }, { id: "feature_2", status: "pending" }],
          _count: { features: 2 },
        },
      ],
    })
  })

  it("returns 401 for unauthenticated POST", async () => {
    authMock.mockResolvedValue(null)
    const { POST } = await import("./route")

    const response = await POST(new Request("http://localhost/api/threads", { method: "POST", body: "{}" }))

    expect(response.status).toBe(401)
  })

  it("creates a thread for authenticated POST with threadId", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1", email: "dev@localhost", name: "Dev User" } })
    prismaMock.thread.create.mockResolvedValue({ id: "thread_1", userId: "user_1" })
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/threads", {
        method: "POST",
        body: JSON.stringify({ threadId: "thread_1" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(prismaMock.thread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: "thread_1", userId: "user_1" }),
      }),
    )
  })
})
