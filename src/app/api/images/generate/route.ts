import { readFile, writeFile } from "fs/promises"
import path from "node:path"
import OpenAI from "openai"
import { auth } from "@/lib/auth"
import { checkModeration, ModerationError } from "@/lib/moderation"

const openai = new OpenAI()

type GenerateImageRequest = {
  productId?: string
  productName?: string
  context?: string
  style?: "lifestyle" | "in-use"
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as GenerateImageRequest
  if (!body.productId || !body.productName) {
    return Response.json({ error: "productId and productName are required" }, { status: 400 })
  }

  const context = body.context?.trim() || "a natural lifestyle setting"
  const style = body.style ?? "lifestyle"

  try {
    await checkModeration(`${context} ${style}`)
  } catch (error) {
    if (error instanceof ModerationError) {
      return Response.json({ error: "That prompt can't be used - please try different wording.", flagged: true }, { status: 400 })
    }
    throw error
  }

  const baseImagePath = path.join(process.cwd(), "sandbox", "public", "images", `${body.productId}-base.png`)
  const baseImageBuffer = await readFile(baseImagePath)
  const baseImageFile = new File([baseImageBuffer], `${body.productId}-base.png`, { type: "image/png" })
  const prompt =
    style === "lifestyle"
      ? `Place this ${body.productName} in ${context}. Lifestyle photography, natural light, aspirational but authentic. Keep the product faithful to the original image.`
      : `Show this ${body.productName} being used in ${context}. Natural context, candid feel. Keep the product faithful to the original image.`

  const response = await openai.images.edit({
    model: "gpt-image-2",
    image: baseImageFile,
    prompt,
    size: "1024x1024",
    n: 1,
    response_format: "b64_json",
  })

  const b64 = response.data?.[0]?.b64_json
  if (!b64) {
    return Response.json({ error: "Image generation failed" }, { status: 502 })
  }

  const filename = `${body.productId}-${Date.now()}.png`
  const destination = path.join(process.cwd(), "sandbox", "public", "images", filename)
  await writeFile(destination, Buffer.from(b64, "base64"))

  return Response.json({ url: `/images/${filename}`, filename })
}
