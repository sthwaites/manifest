import { signIn } from "@/lib/auth"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-50">
      <form
        action={async () => {
          "use server"
          await signIn(process.env.DEBUG_AUTH === "true" ? "credentials" : "auth0", { redirectTo: "/catalogue" })
        }}
        className="flex w-full max-w-sm flex-col gap-5 rounded-lg border border-zinc-700 bg-zinc-900 p-6"
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Sign in to Manifest</h1>
          <p className="text-sm text-zinc-400">Use the local debug session or Auth0 Google sign-in.</p>
        </div>
        <button
          type="submit"
          className="h-10 rounded-md bg-indigo-500 px-4 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  )
}
