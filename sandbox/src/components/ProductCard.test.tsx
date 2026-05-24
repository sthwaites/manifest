import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProductCard } from "./ProductCard"
import type { Product } from "../data/products"

const product: Product = {
  id: "prod_test",
  name: "Test Product",
  category: "Testing",
  description: "A useful product for tests.",
  specs: "10cm · 200g",
  price: 12,
  currency: "GBP",
  image: "/images/prod_test-base.png",
  imagePromptHint: "A test product in soft light",
}

describe("ProductCard", () => {
  it("renders product name, category, description, specs, and price", () => {
    render(<ProductCard product={product} />)

    expect(screen.getByText("Test Product")).toBeInTheDocument()
    expect(screen.getByText("Testing")).toBeInTheDocument()
    expect(screen.getByText("A useful product for tests.")).toBeInTheDocument()
    expect(screen.getByText("10cm · 200g")).toBeInTheDocument()
    expect(screen.getByText("GBP 12")).toBeInTheDocument()
  })

  it("shows a placeholder element when image is null", () => {
    render(<ProductCard product={{ ...product, image: null }} />)

    expect(screen.getByTestId("image-placeholder")).toBeInTheDocument()
    expect(screen.getByTestId("image-placeholder")).toHaveTextContent("Test Product")
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("shows an image with correct src when image is set", () => {
    render(<ProductCard product={product} />)

    const image = screen.getByRole("img", { name: "Test Product" })
    expect(image).toHaveAttribute("src", "/images/prod_test-base.png")
  })

  it("does not render customer-facing image generation controls", () => {
    render(<ProductCard product={product} />)

    expect(screen.queryByRole("button", { name: /Generate image/ })).not.toBeInTheDocument()
  })
})
