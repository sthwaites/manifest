import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const debugAuth = process.env.DEBUG_AUTH === "true"

export default function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/catalogue")) {
    return NextResponse.next()
  }

  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token") ||
    debugAuth

  if (hasSession) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL("/login", req.nextUrl))
}

export const config = {
  matcher: ["/catalogue/:path*"],
}
