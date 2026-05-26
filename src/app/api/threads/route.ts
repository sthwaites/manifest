import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type ThreadRequest = {
  threadId?: string
  summary?: string
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const activeFeatureStatuses = ["pending", "applied"]
  const threads = await prisma.thread.findMany({
    where: {
      userId: session.user.id,
      features: {
        some: { status: { in: activeFeatureStatuses } },
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      features: {
        where: { status: { in: activeFeatureStatuses } },
        select: { id: true, status: true },
      },
    },
  })

  return Response.json({
    threads: threads.map(({ features, ...thread }) => ({
      ...thread,
      features,
      _count: { features: features.length },
    })),
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as ThreadRequest
  if (!body.threadId) {
    return Response.json({ error: "threadId is required" }, { status: 400 })
  }

  await prisma.user.upsert({
    where: { id: session.user.id },
    update: {
      email: session.user.email ?? "dev@localhost",
      name: session.user.name,
      image: session.user.image,
    },
    create: {
      id: session.user.id,
      email: session.user.email ?? "dev@localhost",
      name: session.user.name,
      image: session.user.image,
    },
  })

  const thread = await prisma.thread.create({
    data: {
      id: body.threadId,
      userId: session.user.id,
      summary: body.summary,
    },
  })

  return Response.json({ thread })
}
