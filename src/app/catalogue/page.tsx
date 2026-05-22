import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function CataloguePage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-700 px-6 py-4">
        <h1 className="text-xl font-semibold">Manifest</h1>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_380px]">
        <section className="min-h-[640px] border-r border-zinc-700 bg-zinc-900">
          <iframe title="Sandbox catalogue" src="/sandbox-preview/" className="h-full min-h-[640px] w-full bg-white" />
        </section>
        <aside className="flex flex-col gap-4 p-4">
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
            <h2 className="text-sm font-semibold">Agent</h2>
            <p className="mt-2 text-sm text-zinc-400">Codex App Server streaming lands in the next beat.</p>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
            <h2 className="text-sm font-semibold">Debug</h2>
            <p className="mt-2 text-sm text-zinc-400">Debug panel coming in Beat 7.</p>
          </div>
        </aside>
      </div>
    </main>
  )
}
