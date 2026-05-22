import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export default function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/catalogue")) {
    return NextResponse.next()
  }

  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token") ||
    process.env.DEBUG_AUTH === "true"

  if (hasSession) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL("/login", req.nextUrl))
}

export const config = {
  matcher: ["/catalogue/:path*"],
}
