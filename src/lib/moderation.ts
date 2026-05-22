import OpenAI from "openai"

const openai = new OpenAI()

export class ModerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ModerationError"
  }
}

export async function checkModeration(input: string): Promise<void> {
  const result = await openai.moderations.create({ input })
  const moderation = result.results[0]

  if (!moderation?.flagged) {
    return
  }

  const categories = Object.entries(moderation.categories)
    .filter(([, flagged]) => flagged)
    .map(([category]) => category)

  throw new ModerationError(`Content flagged: ${categories.join(", ")}`)
}
