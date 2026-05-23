import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CatalogueWorkspace } from "./CatalogueWorkspace"

describe("CatalogueWorkspace", () => {
  it("loads the preview from the standalone sandbox dev server", () => {
    render(<CatalogueWorkspace />)

    expect(screen.getByTitle("Sandbox catalogue")).toHaveAttribute("src", "http://localhost:3001/")
  })
})
