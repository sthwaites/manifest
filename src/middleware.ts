import { auth } from "@/lib/auth"

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith("/catalogue")) {
    const loginUrl = new URL("/login", req.nextUrl)
    return Response.redirect(loginUrl)
  }
})

export const config = {
  matcher: ["/catalogue/:path*"],
}
