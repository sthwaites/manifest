import { auth } from "@/lib/auth"
import { getThreadEvents } from "@/lib/event-log"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  return Response.json({ events: getThreadEvents(id) })
}
