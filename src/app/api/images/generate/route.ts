import { readFile, writeFile } from "fs/promises"
import path from "node:path"
import OpenAI, { toFile } from "openai"
import { auth } from "@/lib/auth"
import { checkModeration, ModerationError } from "@/lib/moderation"

let openai: OpenAI | null = null

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

  const body = await readRequestBody(req)
  if (!body) {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  if (!body.productId || !body.productName) {
    return Response.json({ error: "productId and productName are required" }, { status: 400 })
  }

  const context = body.context?.trim() || "a natural lifestyle setting"
  const style = body.style === "in-use" ? "in-use" : "lifestyle"

  try {
    await checkModeration(`${context} ${style}`)
  } catch (error) {
    if (error instanceof ModerationError) {
      return Response.json({ error: "That prompt can't be used - please try different wording.", flagged: true }, { status: 400 })
    }
    return Response.json({ error: "Prompt safety check failed. Try again." }, { status: 502 })
  }

  const baseImagePath = path.join(process.cwd(), "sandbox", "public", "images", `${body.productId}-base.png`)
  const baseImageBuffer = await readBaseImage(baseImagePath)
  if (!baseImageBuffer) {
    return Response.json({ error: "Base product image was not found." }, { status: 404 })
  }

  const baseImageFile = await toFile(baseImageBuffer, `${body.productId}-base.png`, { type: "image/png" })
  const prompt =
    style === "lifestyle"
      ? `Place this ${body.productName} in ${context}. Lifestyle photography, natural light, aspirational but authentic. Keep the product faithful to the original image.`
      : `Show this ${body.productName} being used in ${context}. Natural context, candid feel. Keep the product faithful to the original image.`

  let response: Awaited<ReturnType<OpenAI["images"]["edit"]>>
  try {
    response = await getOpenAI().images.edit({
      model: "gpt-image-2",
      image: baseImageFile,
      prompt,
      size: "1024x1024",
      n: 1,
    })
  } catch (error) {
    return Response.json({ error: formatOpenAIError(error) }, { status: 502 })
  }

  const b64 = response.data?.[0]?.b64_json
  if (!b64) {
    return Response.json({ error: "Image generation failed" }, { status: 502 })
  }

  // Generated files sit beside committed base images so the sandbox can swap URLs without moving assets.
  const filename = `${body.productId}-${Date.now()}.png`
  const destination = path.join(process.cwd(), "sandbox", "public", "images", filename)
  try {
    await writeFile(destination, Buffer.from(b64, "base64"))
  } catch {
    return Response.json({ error: "Generated image could not be saved." }, { status: 500 })
  }

  return Response.json({ url: `/images/${filename}`, filename })
}

function getOpenAI() {
  openai ??= new OpenAI()
  return openai
}

function formatOpenAIError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message
    if (typeof message === "string" && message.trim()) {
      return `Image generation service failed: ${message}`
    }
  }
  return "Image generation service failed. Try again."
}

async function readRequestBody(req: Request): Promise<GenerateImageRequest | null> {
  try {
    const body = (await req.json()) as unknown
    return body && typeof body === "object" ? (body as GenerateImageRequest) : null
  } catch {
    return null
  }
}

async function readBaseImage(baseImagePath: string) {
  try {
    return await readFile(baseImagePath)
  } catch {
    return null
  }
}
