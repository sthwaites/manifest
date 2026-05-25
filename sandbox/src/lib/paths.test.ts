import { afterEach, describe, expect, it } from "vitest"
import { withSandboxBasePath } from "./paths"

describe("withSandboxBasePath", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SANDBOX_BASE_PATH
  })

  it("leaves local absolute paths unchanged without a base path", () => {
    expect(withSandboxBasePath("/images/prod_001-base.png")).toBe("/images/prod_001-base.png")
  })

  it("prefixes sandbox assets when deployed under a base path", () => {
    process.env.NEXT_PUBLIC_SANDBOX_BASE_PATH = "/sandbox"

    expect(withSandboxBasePath("/images/prod_001-base.png")).toBe("/sandbox/images/prod_001-base.png")
    expect(withSandboxBasePath("/image-overrides.json")).toBe("/sandbox/image-overrides.json")
  })

  it("does not double-prefix paths", () => {
    process.env.NEXT_PUBLIC_SANDBOX_BASE_PATH = "/sandbox/"

    expect(withSandboxBasePath("/sandbox/images/prod_001-base.png")).toBe("/sandbox/images/prod_001-base.png")
  })
})
