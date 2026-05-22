import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AgentStream } from "./AgentStream"
import type { AgentEvent } from "./AgentStream"

describe("AgentStream", () => {
  it("renders an empty state message when no events are present", () => {
    render(<AgentStream events={[]} />)

    expect(screen.getByText("No agent events yet.")).toBeInTheDocument()
  })

  it("renders an agentMessage event as a readable text bubble", () => {
    render(<AgentStream events={[{ type: "agentMessage", message: "I updated the grid." }]} />)

    expect(screen.getByText("I updated the grid.")).toBeInTheDocument()
  })

  it("renders a fileChange event with filename and status badge", () => {
    render(<AgentStream events={[{ type: "fileChange", path: "src/app/page.tsx", status: "modified" }]} />)

    expect(screen.getByText("src/app/page.tsx")).toBeInTheDocument()
    expect(screen.getByText("modified")).toBeInTheDocument()
  })

  it("renders a commandExecution event with monospace command text", () => {
    const event: AgentEvent = { type: "commandExecution", command: "npm run test -- --run", exitCode: 0 }

    render(<AgentStream events={[event]} />)

    expect(screen.getByText("npm run test -- --run")).toBeInTheDocument()
    expect(screen.getByText("exit 0")).toBeInTheDocument()
  })
})
