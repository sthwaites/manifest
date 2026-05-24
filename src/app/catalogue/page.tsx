import { auth, signOut } from "@/lib/auth"
import { ensureWebSocketBridge } from "@/lib/ws-bridge"
import { redirect } from "next/navigation"
import { CatalogueWorkspace } from "@/components/CatalogueWorkspace"

export const dynamic = "force-dynamic"

export default async function CataloguePage() {
  const session = await auth()
  const debugAuthEnabled = process.env.DEBUG_AUTH === "true"

  if (!session) {
    redirect("/login")
  }

  ensureWebSocketBridge()

  async function logoutAction() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <CatalogueWorkspace
      userName={session.user?.name ?? null}
      userEmail={session.user?.email ?? null}
      debugAuthEnabled={debugAuthEnabled}
      sandboxUrl={process.env.NEXT_PUBLIC_SANDBOX_PUBLIC_URL ?? "http://localhost:3001/"}
      logoutAction={logoutAction}
    />
  )
}
