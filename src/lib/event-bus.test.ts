import { describe, expect, it } from "vitest"
import { eventBus } from "./event-bus"

describe("eventBus", () => {
  it("emits events to a listener with the expected payload", async () => {
    const payload = { type: "agentMessage", message: "Hello" }

    await expect(
      new Promise((resolve) => {
        eventBus.once("app-server-event", resolve)
        eventBus.emit("app-server-event", payload)
      }),
    ).resolves.toEqual(payload)
  })

  it("emits the same event to multiple listeners", () => {
    const payload = { type: "fileChange", path: "src/app/page.tsx" }
    const received: unknown[] = []

    const first = (event: unknown) => received.push(event)
    const second = (event: unknown) => received.push(event)

    eventBus.on("app-server-event", first)
    eventBus.on("app-server-event", second)
    eventBus.emit("app-server-event", payload)
    eventBus.off("app-server-event", first)
    eventBus.off("app-server-event", second)

    expect(received).toEqual([payload, payload])
  })
})
