import { describe, expect, it } from "vitest"
import { baselineProducts } from "./baseline-products"

describe("baselineProducts", () => {
  it("contains the six baseline catalogue products with image ids", () => {
    expect(baselineProducts).toHaveLength(6)
    expect(baselineProducts.map((product) => product.id)).toEqual(["prod_001", "prod_002", "prod_003", "prod_004", "prod_005", "prod_006"])
  })
})
