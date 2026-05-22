import { DebugPanel } from "@/components/DebugPanel"
import { getThreadEvents } from "@/lib/event-log"

type DebugPageProps = {
  params: Promise<{ threadId: string }>
}

export default async function DebugPage({ params }: DebugPageProps) {
  const { threadId } = await params
  const events = getThreadEvents(threadId)

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-50">
      <DebugPanel threadId={threadId} events={events} />
    </main>
  )
}
