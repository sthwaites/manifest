import { mkdir, readFile, writeFile } from "fs/promises"
import path from "node:path"
import { auth } from "@/lib/auth"
import { beginBridgeOperation, endBridgeOperation } from "@/lib/ws-bridge"

type ApplyImageRequest = {
  productId?: string
  url?: string
}

type ImageOverrides = Record<string, string>

const IMAGE_OVERRIDES_FILENAME = "image-overrides.json"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await readRequestBody(req)
  if (!body?.productId || !body.url) {
    return Response.json({ error: "productId and url are required" }, { status: 400 })
  }

  if (!isSandboxImageUrl(body.url)) {
    return Response.json({ error: "Only sandbox image URLs can be applied." }, { status: 400 })
  }

  const operation = beginBridgeOperation("image")
  if (!operation.ok) {
    return Response.json({ error: "Sandbox is busy", operation: operation.operation }, { status: 409 })
  }

  const filePath = imageOverridesPath()
  try {
    const overrides = await readOverrides(filePath)
    overrides[body.productId] = body.url
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, `${JSON.stringify(overrides, null, 2)}\n`)
    return Response.json({ overrides })
  } catch {
    return Response.json({ error: "Image override could not be saved." }, { status: 500 })
  } finally {
    endBridgeOperation("image")
  }
}

async function readRequestBody(req: Request): Promise<ApplyImageRequest | null> {
  try {
    const body = (await req.json()) as unknown
    return body && typeof body === "object" ? (body as ApplyImageRequest) : null
  } catch {
    return null
  }
}

function isSandboxImageUrl(url: string) {
  return /^\/images\/[a-zA-Z0-9_-]+(?:-\d+|-base)?\.png$/.test(url)
}

function imageOverridesPath() {
  return path.join(process.cwd(), "sandbox", "public", IMAGE_OVERRIDES_FILENAME)
}

async function readOverrides(filePath: string): Promise<ImageOverrides> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && isSandboxImageUrl(entry[1])),
    )
  } catch {
    return {}
  }
}
