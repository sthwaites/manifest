import OpenAI from "openai"
import { auth } from "@/lib/auth"

const openai = new OpenAI()

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("audio")
  if (!(file instanceof File)) return Response.json({ error: "No audio" }, { status: 400 })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  })

  return Response.json({ text: transcription.text })
}
