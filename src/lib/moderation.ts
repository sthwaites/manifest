import OpenAI from "openai"

let openai: OpenAI | null = null

export class ModerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ModerationError"
  }
}

export async function checkModeration(input: string): Promise<void> {
  const result = await getOpenAI().moderations.create({ input })
  const moderation = result.results[0]

  if (!moderation?.flagged) {
    return
  }

  const categories = Object.entries(moderation.categories)
    .filter(([, flagged]) => flagged)
    .map(([category]) => category)

  throw new ModerationError(`Content flagged: ${categories.join(", ")}`)
}

function getOpenAI() {
  openai ??= new OpenAI()
  return openai
}
