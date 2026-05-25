import OpenAI from "openai"
import { auth } from "@/lib/auth"

let openai: OpenAI | null = null

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("audio")
  if (!(file instanceof File)) return Response.json({ error: "No audio" }, { status: 400 })

  try {
    const transcription = await getOpenAI().audio.transcriptions.create({
      file,
      model: "whisper-1",
    })

    return Response.json({ text: transcription.text })
  } catch (error) {
    if (isOpenAIError(error, "audio_too_short")) {
      return Response.json({ error: "Record for at least one second before transcribing." }, { status: 400 })
    }
    console.error(error)
    return Response.json({ error: "Transcription failed. Try recording again." }, { status: 500 })
  }
}

function getOpenAI() {
  openai ??= new OpenAI()
  return openai
}

function isOpenAIError(error: unknown, code: string) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === code)
}
