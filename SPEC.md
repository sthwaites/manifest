# Manifest — Codex Build Spec

## Concept

A self-modifying product catalogue. Operators type a feature request in plain English; Codex App Server rewrites the running sandbox source; the catalogue hot-reloads with the new feature live. Multi-model: Codex writes code, GPT Image API generates lifestyle product photography.

## Architecture — Two-tier

```
Main app (port 3000)          Sandbox app (port 3001)
─────────────────────         ───────────────────────
Auth / sessions               The product catalogue
Thread history                being rewritten by Codex
Feature request UI            Separate Next.js dev server
Agent stream panel            Embedded in main app iframe
Debug panel / log             Gets file writes → hot-reloads
Image generation UI
```

Codex App Server is spawned by the main app as a **child process** (stdio transport). The main app proxies events to the browser via WebSocket. The App Server's `workspaceWrite` sandbox is scoped to `./sandbox/`.

## Baseline page (`/baseline`)

A public, auth-free page showing the raw catalogue in its initial state — six products, base studio images, no added features. This is the starting point the Loom demo anchors from. It imports the same seed product data as the sandbox so the two are always in sync.

```
/baseline
─────────
Header:  "Manifest — starting point"
         Subtitle: "Six products. Studio shots. No features. This is what we give Codex."
         CTA button: "Sign in to modify →" (links to /login)

Body:    Responsive product grid (same layout as sandbox)
         Each card: base image, name, category, specs, price
         No search bar, no filters, no cart — intentionally bare

Footer:  "Built with Codex in a 4-hour window"
```

Implementation notes:
- No `auth()` check — the page is intentionally public.
- Import products directly from `../../sandbox/src/data/products` (relative path — works because sandbox is a subdirectory of the main app).
- Images served from `/sandbox/public/images/` via a Next.js `rewrites` rule pointing `/_sandbox-images/*` → the sandbox dev server (local) or static assets (production).
- Light background (`bg-white` / `bg-zinc-50`) — deliberate contrast with the dark main app. The visual shift when navigating to `/catalogue` signals that something different is happening.

## Tech stack

```
Framework:    Next.js 15 App Router, TypeScript strict
Styling:      Tailwind CSS 4, shadcn/ui components
ORM:          Prisma 6 + SQLite  (file: ./data/dev.db)
Auth:         NextAuth v5 + Auth0 provider (Google OAuth)
              DEBUG_AUTH=true env var → bypass for local dev
Images:       OpenAI gpt-image-2 via /api/images/generate
Codex:        App Server (codex app-server, stdio ↔ WebSocket)
Tests:        Vitest + React Testing Library + @testing-library/user-event
Containers:   Docker Compose (two services: app + sandbox)
              Production: concurrently runs both in one container
Deploy:       Fly.io (fly.toml in root)
```

## Directory layout

```
part2-demo-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # root layout, ThemeProvider, auth session
│   │   ├── page.tsx                # redirect → /baseline
│   │   ├── baseline/page.tsx       # public read-only: raw catalogue + base images (no auth)
│   │   ├── login/page.tsx          # sign in page
│   │   ├── catalogue/page.tsx      # main app: 3-tab layout (auth required)
│   │   └── api/
│   │       ├── auth/[...nextauth]/ # NextAuth handler
│   │       ├── ws/route.ts         # WebSocket bridge → App Server stdio
│   │       ├── threads/route.ts    # list / create threads
│   │       ├── rollback/route.ts   # thread/rollback + git reset in sandbox
│   │       ├── reset/route.ts      # git reset --hard baseline + restart App Server
│   │       ├── transcribe/route.ts # Whisper API: audio blob → transcribed text
│   │       └── images/generate/route.ts
│   ├── components/
│   │   ├── Tabs.tsx                # App / Agent / Debug tabs
│   │   ├── FeatureRequest.tsx      # text input + submit
│   │   ├── AgentStream.tsx         # readable event stream display
│   │   ├── DebugPanel.tsx          # raw JSON-RPC event log
│   │   ├── ThreadHistory.tsx       # past sessions sidebar
│   │   └── ImageModal.tsx          # per-product image generation
│   └── lib/
│       ├── auth.ts                 # NextAuth config
│       ├── prisma.ts               # Prisma client singleton
│       ├── codex-server.ts         # App Server spawn + stdio protocol
│       ├── event-bus.ts            # in-process event emitter (stdio → WS)
│       └── moderation.ts           # Moderation API gate for user-supplied prompts
├── sandbox/                        # The app Codex rewrites (its own git repo)
│   ├── .git/                       # initialised during Beat 1; tracks every Codex rewrite
│   ├── src/app/
│   │   ├── page.tsx                # product grid
│   │   └── layout.tsx
│   ├── src/components/
│   │   └── ProductCard.tsx
│   ├── src/data/
│   │   └── products.ts             # seed product data
│   ├── public/images/              # generated product images land here
│   └── package.json
├── prisma/
│   └── schema.prisma
├── data/                           # SQLite DB (Docker volume)
├── docker-compose.yml
├── Dockerfile
├── fly.toml
└── AGENTS.md
```

## Data model

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?
  image     String?
  createdAt DateTime  @default(now())
  threads   Thread[]
  accounts  Account[]
  sessions  Session[]
}

model Thread {
  id        String    @id  // Codex App Server thread ID (thr_xxx)
  userId    String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  summary   String?
  user      User      @relation(fields: [userId], references: [id])
  features  Feature[]
}

model Feature {
  id        String   @id @default(cuid())
  threadId  String
  prompt    String
  diff      String?  // unified diff from fileChange events
  status    String   @default("pending") // pending | applied | failed
  createdAt DateTime @default(now())
  thread    Thread   @relation(fields: [threadId], references: [id])
}

// NextAuth v5 adapter tables
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}
```

## Auth — NextAuth v5 + Auth0

```ts
// src/lib/auth.ts
import NextAuth from "next-auth"
import Auth0 from "next-auth/providers/auth0"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"

const DEBUG_AUTH = process.env.DEBUG_AUTH === "true"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: DEBUG_AUTH
    ? [Credentials({
        credentials: {},
        authorize: () => ({
          id: "debug-user",
          email: "dev@localhost",
          name: "Dev User",
        }),
      })]
    : [Auth0({
        clientId: process.env.AUTH0_CLIENT_ID!,
        clientSecret: process.env.AUTH0_CLIENT_SECRET!,
        issuer: process.env.AUTH0_ISSUER!,
      })],
  pages: { signIn: "/login" },
  session: { strategy: "database" },
})
```

`DEBUG_AUTH=true` is set in `docker-compose.yml`. Never set it in production.

## Codex App Server integration

```ts
// src/lib/codex-server.ts
import { spawn, ChildProcess } from "child_process"
import * as readline from "readline"
import { eventBus } from "./event-bus"

let proc: ChildProcess | null = null

export function startAppServer(sandboxDir: string) {
  proc = spawn("codex", ["app-server"], {
    cwd: sandboxDir,
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, OPENAI_API_KEY: process.env.OPENAI_API_KEY },
  })

  const rl = readline.createInterface({ input: proc.stdout! })
  rl.on("line", (line) => {
    try {
      const msg = JSON.parse(line)
      eventBus.emit("app-server-event", msg)
    } catch {}
  })

  return {
    send: (msg: unknown) => proc!.stdin!.write(JSON.stringify(msg) + "\n"),
  }
}

export function restartAppServer(sandboxDir: string) {
  if (proc) {
    proc.kill()
    proc = null
  }
  startAppServer(sandboxDir)
}
```

## Transcription — Whisper push-to-record

The `FeatureRequest` component has a push-to-record mic button. Holding the button captures audio via `MediaRecorder`; releasing stops the recording and POSTs the blob to `/api/transcribe`, which calls Whisper. The transcribed text populates the input field — the user can edit before submitting.

```ts
// src/app/api/transcribe/route.ts
import OpenAI from "openai"
import { auth } from "@/lib/auth"

const openai = new OpenAI()

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("audio") as File
  if (!file) return Response.json({ error: "No audio" }, { status: 400 })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  })

  return Response.json({ text: transcription.text })
}
```

**`FeatureRequest` mic button behaviour:**
- Idle state: mic icon button (`text-zinc-400 hover:text-zinc-200`) next to the submit button
- `mousedown` / `touchstart`: call `navigator.mediaDevices.getUserMedia({ audio: true })`, start `MediaRecorder`. Button turns red (`text-rose-500`) with a pulsing ring (`animate-pulse`). Input placeholder changes to "Listening…"
- `mouseup` / `touchend`: stop `MediaRecorder`, collect blob chunks. Button shows spinner. POST `FormData` with `audio` file to `/api/transcribe`.
- On success: set input value to transcribed text. User reviews and edits before submitting normally.
- On error (mic denied, API failure): show inline error, reset to idle.
- If browser does not support `MediaRecorder`: hide the mic button entirely (feature-detect on mount).

No moderation is run on transcription — the text appears in the input field and moderation runs normally on submit.

The WebSocket API route (`/api/ws`) accepts browser WebSocket connections, subscribes to `eventBus`, and forwards events to the client. It also accepts inbound messages from the client and forwards them to the App Server stdin.

**Auto-commit after each turn (rollback support):**

When the WebSocket bridge receives `turn/completed`, run inside `./sandbox/`:
```bash
git add -A && git commit -m "turn:{turnId} thread:{threadId}"
```
This creates one commit per feature request. The sandbox's git history is independent of the main app's history (sandbox is its own repo). On rollback: `git reset --hard HEAD~1` restores files, hot-reload fires automatically.

**Initialization sequence on first connection:**
```json
{ "method": "initialize", "id": 1, "params": { "capabilities": { "optOutNotificationMethods": [] } } }
{ "method": "initialized", "params": {} }
```

**Starting a turn:**
```json
{ "method": "thread/start", "id": 2, "params": { "model": "gpt-5.5", "ephemeral": false } }
// wait for thread/started notification → get threadId
{ "method": "turn/start", "id": 3, "params": {
    "threadId": "<threadId>",
    "input": [{ "type": "text", "text": "<user feature request>" }],
    "sandboxPolicy": { "type": "workspaceWrite", "writableRoots": ["<abs-path-to-sandbox>"] }
  }
}
```

## Moderation

Every user-supplied prompt is gated through the OpenAI Moderation API before reaching either the Images API or the Codex App Server. Two entry points: the image generation route (`/api/images/generate`) and the WebSocket bridge (`/api/ws`) before forwarding feature requests to the App Server.

```ts
// src/lib/moderation.ts
import OpenAI from "openai"
const openai = new OpenAI()

export async function checkModeration(input: string): Promise<void> {
  const result = await openai.moderations.create({ input })
  if (result.results[0].flagged) {
    const categories = Object.entries(result.results[0].categories)
      .filter(([, flagged]) => flagged)
      .map(([cat]) => cat)
    throw new ModerationError(`Content flagged: ${categories.join(", ")}`)
  }
}

export class ModerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ModerationError"
  }
}
```

Callers catch `ModerationError` and return `{ error: "That prompt can't be used — please try different wording.", flagged: true }` with status 400. The Moderation API is free and responds in ~50–100ms — the latency is invisible in both paths (image generation takes 3–8s; feature requests stream so the check happens before the first event).

## Image generation

Products ship with base images (white background studio shots) committed to `sandbox/public/images/prod_00N-base.png`. The generate route uses `images.edit` to place the product into a lifestyle context — the product's shape and detail carry through into the output.

```ts
// src/app/api/images/generate/route.ts
import OpenAI from "openai"
import { writeFile, readFile } from "fs/promises"
import path from "path"
import { auth } from "@/lib/auth"
import { checkModeration, ModerationError } from "@/lib/moderation"

const openai = new OpenAI()

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { productId, productName, context, style } = await req.json()

  try {
    await checkModeration(`${context} ${style}`)
  } catch (err) {
    if (err instanceof ModerationError)
      return Response.json({ error: "That prompt can't be used — please try different wording.", flagged: true }, { status: 400 })
    throw err
  }

  const baseImagePath = path.join(process.cwd(), "sandbox", "public", "images", `${productId}-base.png`)
  const baseImageBuffer = await readFile(baseImagePath)
  const baseImageBlob = new Blob([baseImageBuffer], { type: "image/png" })
  const baseImageFile = new File([baseImageBlob], `${productId}-base.png`, { type: "image/png" })

  const prompt = style === "lifestyle"
    ? `Place this ${productName} in ${context}. Lifestyle photography, natural light, aspirational but authentic. Keep the product faithful to the original image.`
    : `Show this ${productName} being used in ${context}. Natural context, candid feel. Keep the product faithful to the original image.`

  const response = await openai.images.edit({
    model: "gpt-image-2",
    image: baseImageFile,
    prompt,
    size: "1024x1024",
    n: 1,
    response_format: "b64_json",
  })

  const b64 = response.data[0].b64_json!
  const filename = `${productId}-${Date.now()}.png`
  const dest = path.join(process.cwd(), "sandbox", "public", "images", filename)
  await writeFile(dest, Buffer.from(b64, "base64"))

  return Response.json({ url: `/images/${filename}`, filename })
}
```

**ImageModal layout — before/after split:**
- Left panel: base image (`/images/{productId}-base.png`) — always visible
- Right panel: placeholder ("Generate to preview", grey gradient) until generated, then the lifestyle result
- "Use this image" button writes the generated image path to the product data, hot-reloads the card
- Style options: "Lifestyle scene" | "In use"

## Debug panel

The Debug tab (`/catalogue?tab=debug` or toggled in-page) shows:
- Thread ID and token usage counter
- Scrollable event log: `[timestamp] event-type  item-type  →  payload preview`
- Clicking any row expands the full raw JSON
- `fileChange` items show an inline unified diff (using `diff2html` or a simple line-diff component)
- "Copy as JSON" button exports the full session log
- **"Undo last change" button** — calls `POST /api/rollback` which: (1) calls `thread/rollback` on the App Server to remove the last turn from context, (2) runs `git reset --hard HEAD~1` inside `./sandbox/`, (3) returns the rolled-back commit message. Hot-reload fires automatically when files revert. Updates the Feature record status to `"rolled_back"`. Button disabled if no turns to roll back.
- **"Reset to baseline" button** — shadcn/ui AlertDialog with warning ("This will discard all Codex changes and return the catalogue to its original state. There is no undo."). On confirm: calls `POST /api/reset` which runs `git reset --hard baseline` inside `./sandbox/` (the `baseline` tag is set during Beat 1 init) and calls `restartAppServer()`. On success: toast "Sandbox reset to baseline" + iframe full src reload. Always enabled. Styled `text-orange-400 hover:text-orange-300` to distinguish from Undo.

Also accessible at `/debug/[threadId]` — a standalone shareable URL per session. Useful for the Fly.io deploy: link evaluators directly to a recorded session's debug log.

## Seed products

```ts
// sandbox/src/data/products.ts
export const products = [
  {
    id: "prod_001",
    name: "Ceramic Pour-Over Coffee Set",
    category: "Kitchen",
    description: "Handthrown stoneware dripper and server. Matt glaze finish.",
    specs: "450ml capacity · 18cm height · 320g",
    price: 42,
    image: "/images/prod_001-base.png",
  },
  {
    id: "prod_002",
    name: "Merino Wool Throw Blanket",
    category: "Home",
    description: "Extra-fine 17.5 micron merino. Woven in Portugal.",
    specs: "130×170cm · 400g/m² · hand wash cold",
    price: 89,
    image: "/images/prod_002-base.png",
  },
  {
    id: "prod_003",
    name: "Bamboo Desk Organiser",
    category: "Office",
    description: "Three-tier tray system. FSC-certified bamboo.",
    specs: "24×18×10cm · 380g",
    price: 28,
    image: "/images/prod_003-base.png",
  },
  {
    id: "prod_004",
    name: "Copper Cocktail Shaker",
    category: "Bar",
    description: "Seamless copper, weighted base, leak-proof seal.",
    specs: "750ml · 28cm · solid copper with tin lining",
    price: 35,
    image: "/images/prod_004-base.png",
  },
  {
    id: "prod_005",
    name: "Linen Tote Bag",
    category: "Accessories",
    description: "Undyed Belgian linen. Reinforced cotton handles.",
    specs: "40×38cm · natural · 180g",
    price: 22,
    image: "/images/prod_005-base.png",
  },
  {
    id: "prod_006",
    name: "Brass Candlestick Trio",
    category: "Home",
    description: "Hand-turned solid brass. Three graduated heights.",
    specs: "8 / 12 / 16cm height · 1.2kg combined",
    price: 54,
    image: "/images/prod_006-base.png",
  },
]
```

## Tests required

Write tests for these modules (Vitest + RTL):

1. `src/lib/moderation.test.ts`
   - Mock `openai.moderations.create`
   - Clean prompt → resolves without throwing
   - Flagged prompt → throws `ModerationError` with correct category string
   - Multiple flagged categories → all included in message

2. `src/lib/codex-server.test.ts`
   - Spawns App Server with a mock binary; confirms initialize message sent
   - Parses incoming JSONL events correctly
   - Handles malformed JSON lines without crashing

3. `src/app/api/images/generate/route.test.ts`
   - Rejects unauthenticated requests (401)
   - Returns 400 when moderation flags the prompt (mock `checkModeration` to throw `ModerationError`)
   - Calls OpenAI API with correctly formed prompt
   - Writes file and returns URL (mock `writeFile`)

4. `src/components/AgentStream.test.tsx`
   - Renders empty state when no events
   - Renders `agentMessage` event as readable text
   - Renders `fileChange` event with filename and status badge
   - Renders `commandExecution` event with command text

5. `src/app/api/threads/route.test.ts`
   - GET without session → 401
   - GET with session → 200, returns thread array (mock Prisma)
   - POST without session → 401
   - POST with threadId → 200, creates Thread record

6. `src/app/api/rollback/route.test.ts`
   - POST without session → 401
   - POST with session → calls thread/rollback on App Server, runs git reset, returns { message }

7. `src/app/api/reset/route.test.ts`
   - POST without session → 401
   - POST with session → calls `git reset --hard baseline` in sandbox, calls `restartAppServer`, returns { message }
   (Mock `execSync` and `restartAppServer`.)

8. `src/app/api/transcribe/route.test.ts`
   - POST without session → 401
   - POST without audio field → 400
   - POST with audio file → calls `openai.audio.transcriptions.create` with `model: "whisper-1"`, returns `{ text }`
   (Mock `openai.audio.transcriptions.create`.)

9. `src/components/DebugPanel.test.tsx`
   - Renders each event as a collapsed row with timestamp and type
   - Click expands to show raw JSON in a `<pre>` block; click again collapses
   - Copy button triggers `navigator.clipboard.writeText`
   - "Undo last change" button is disabled when no turns exist
   - "Reset to baseline" button is always enabled
   - Clicking "Reset to baseline" opens AlertDialog with warning text
   - Confirming AlertDialog calls `POST /api/reset` and shows success toast
   - Cancelling AlertDialog does not call the route

10. `sandbox/src/components/ProductCard.test.tsx`
   - Renders all fields (name, category, specs, price)
   - Shows placeholder when `image` is null
   - Shows `<img>` with correct src when image is set

All tests must pass: `npm run test -- --run`

## Environment variables

```bash
# .env.local (never committed — see .env.example)
OPENAI_API_KEY=sk-...
NEXTAUTH_SECRET=...                    # openssl rand -base64 32
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_ISSUER=https://dev-xxxx.us.auth0.com
DEBUG_AUTH=false                       # true in docker-compose.yml
DATABASE_URL=file:./data/dev.db
NEXTAUTH_URL=http://localhost:3000     # update for Fly.io
```

## Docker Compose

```yaml
services:
  app:
    build: .
    command: npm run dev
    ports: ["3000:3000"]
    volumes:
      - .:/app
      - /app/node_modules
      - db_data:/app/data
      - sandbox_src:/app/sandbox    # App Server writes here; shared with sandbox service
    environment:
      DATABASE_URL: file:/app/data/dev.db
      DEBUG_AUTH: "true"
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: http://localhost:3000
    depends_on: [sandbox]

  sandbox:
    build: ./sandbox
    command: npm run dev -- --port 3001
    ports: ["3001:3001"]
    volumes:
      - sandbox_src:/sandbox        # watches same source tree the App Server writes to
      - /sandbox/node_modules

volumes:
  db_data:
  sandbox_src:                      # shared between app (/app/sandbox) and sandbox (/sandbox)
```

## Dockerfile (production)

Both the main app and the sandbox dev server run in a single Fly.io container using `concurrently`. The sandbox dev server runs on port 3001 (internal only); the main app proxies it via a Next.js `rewrites` rule so the browser can reach it through the single public port 3000.

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build
# Build sandbox deps
RUN cd sandbox && npm ci

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Install codex binary — App Server runs headlessly via CODEX_API_KEY
RUN npm install -g @openai/codex
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/sandbox ./sandbox
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && \
  npx concurrently \
    \"npm start\" \
    \"cd /app/sandbox && npm run dev -- --port 3001 --hostname 127.0.0.1\""]
```

**Next.js rewrites — sandbox proxy:**

```js
// next.config.js
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/sandbox-preview/:path*',
        destination: 'http://localhost:3001/:path*',
      },
    ]
  },
}
```

The catalogue iframe points to `/sandbox-preview/` (not `http://localhost:3001` directly), so it works from any browser regardless of where the app is hosted.

**Iframe reload on `turn/completed`:**

In `catalogue/page.tsx`, when the WebSocket receives `turn/completed`, reload the iframe after a short delay to let the sandbox dev server pick up the file changes:

```tsx
if (event.type === 'turn/completed') {
  setTimeout(() => {
    if (sandboxIframeRef.current) {
      sandboxIframeRef.current.src = sandboxIframeRef.current.src
    }
  }, 1500)
}
```

For local development, Next.js HMR fires automatically (file changes are detected mid-turn, so the iframe updates before `turn/completed`). On Fly.io, the full-page reload on completion achieves the same end result: the new feature is visible in the iframe when Codex finishes.

The `CODEX_API_KEY` env var (set to the same value as `OPENAI_API_KEY`) authenticates the App Server headlessly — no browser login needed in production.

**What works on Fly.io vs locally:**

| Feature | Local | Fly.io |
|---------|-------|--------|
| Sign in with Google | ✅ | ✅ |
| /baseline page | ✅ | ✅ |
| Image generation (gpt-image-2) | ✅ | ✅ |
| Push-to-record (Whisper) | ✅ | ✅ |
| Feature requests → App Server runs | ✅ | ✅ |
| File change events in Debug panel | ✅ | ✅ |
| Sandbox iframe shows updated features | ✅ HMR mid-turn | ✅ full reload on turn/completed |

## Non-goals

- No approval gate UI (turn/steer and turn/interrupt are future work — mention in Loom)
- No concurrent multi-user sandbox sessions
- No true HMR on Fly.io (full iframe reload on turn/completed instead — functionally equivalent for evaluators)
- No payment, cart, or checkout functionality
- No image editing / inpainting
- No ChatGPT OAuth (future: swap Auth0's Google connection for ChatGPT OIDC)
- No Plugin scaffolding (mention as "what I'd add" in Loom)

## Definition of done

- [ ] `docker compose up` starts both services with no errors
- [ ] Sign in with Google (or DEBUG_AUTH) works and persists session
- [ ] Typing a feature request and submitting starts an App Server turn
- [ ] Agent stream panel shows live events from App Server
- [ ] At least one complete feature request modifies sandbox source + hot-reloads
- [ ] Image generation modal generates and displays a product image
- [ ] Debug panel shows raw event log with expandable rows
- [ ] All 10 test suites pass: `npm run test -- --run`
- [ ] `fly deploy` deploys successfully and app is accessible at Fly URL
