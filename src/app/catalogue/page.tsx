import { auth } from "@/lib/auth"
import { ensureWebSocketBridge } from "@/lib/ws-bridge"
import { redirect } from "next/navigation"
import { CatalogueWorkspace } from "@/components/CatalogueWorkspace"

export default async function CataloguePage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  ensureWebSocketBridge()

  return <CatalogueWorkspace />
}
