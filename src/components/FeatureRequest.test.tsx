import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FeatureRequest } from "./FeatureRequest"

class MockWebSocket {
  static OPEN = 1
  readonly url: string
  readyState = MockWebSocket.OPEN
  close = vi.fn()
  send = vi.fn()

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  addEventListener = vi.fn()

  static instances: MockWebSocket[] = []
}

describe("FeatureRequest", () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal("WebSocket", MockWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("connects directly to the local bridge on localhost", () => {
    render(<FeatureRequest onEvent={vi.fn()} onConnectionChange={vi.fn()} />)

    expect(MockWebSocket.instances[0]?.url).toBe("ws://localhost:3002/api/ws")
  })
})
