# Manifest — 4-Hour Build Prompt Sequence

Paste each beat into Codex when the previous one is complete. Target times are guides, not hard stops.

Each beat (2–7) follows a strict RED → GREEN → VERIFY GATE pattern:
- RED: write tests first, confirm they fail
- GREEN: implement until tests pass
- VERIFY GATE: manual browser/docker check — do not proceed to the next beat if the gate fails

---

## PRE-FLIGHT (before starting the clock)

These are manual steps that can't be done by Codex. Complete them before the 4h window opens:

- [ ] Auth0 app registered → `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_ISSUER` noted
- [ ] Auth0 callback URLs added: `http://localhost:3000/api/auth/callback/auth0`
- [ ] OpenAI API key available with Images API access (gpt-image-2 required)
- [ ] **Base product images generated and committed:**
      pip install openai
      OPENAI_API_KEY=sk-... python3 seed/generate-base-images.py
      git add sandbox/public/images/*-base.png && git commit -m "chore: add base product images"
- [ ] `.env.local` file created from `.env.example`
- [ ] `fly launch` run → Fly app URL noted → Auth0 callback URL updated
- [ ] `fly secrets set OPENAI_API_KEY=... NEXTAUTH_SECRET=... AUTH0_CLIENT_ID=... ...`

---

## BEAT 1 — Bootstrap (target: 15 min)

```
Read SPEC.md and AGENTS.md carefully. Then bootstrap the Manifest repository:

1. Confirm you are running from `part2-demo-app/`, then initialise a Next.js 15 App Router project with TypeScript and Tailwind CSS in that directory (not a nested subdirectory).
2. Install dependencies: prisma, @prisma/client, next-auth@beta, @auth/prisma-adapter, openai, shadcn/ui, vitest, @vitejs/plugin-react, @testing-library/react, @testing-library/user-event, jsdom, concurrently.
3. Scaffold the directory structure from SPEC.md exactly.
4. Create prisma/schema.prisma with all models from SPEC.md.
5. Create .env.example with all required variables (no real values).
6. Create docker-compose.yml from SPEC.md.
7. Create Dockerfile (dev target: node:20-alpine, npm run dev).
8. Create vitest.config.ts.
9. Create next.config.js with a rewrites rule that proxies /sandbox-preview/* to http://localhost:3001/*:
   module.exports = { async rewrites() { return [{ source: '/sandbox-preview/:path*', destination: 'http://localhost:3001/:path*' }] } }
   This makes the sandbox accessible through the main app on both local and Fly.io.
10. Create plans.md with the build plan.
11. Run: npx prisma generate
11. Initialise the sandbox as its own git repo:
    cd sandbox && git init && git add . && git commit -m "baseline" && git tag baseline
    (Separate from the main repo. The "baseline" tag is the reset target. Every Codex turn will
    auto-commit here for rollback support.)

Do not run migrations yet. Do not start the dev server.
(Step 10 was renumbered — step 11 is now npx prisma generate.)

GATE: npm run build — must succeed with no TypeScript errors before proceeding.
```

---

## BEAT 2 — Auth + persistence (target: 30 min)

```
$scaffold-feature

Implement authentication and user sessions using SPEC.md §Auth.
Follow TDD: write tests first, confirm they fail, then implement.

--- RED ---
1. Write src/lib/auth.test.ts:
   - When DEBUG_AUTH=true: auth() returns a session with id "debug-user" and email "dev@localhost"
   - Unauthenticated request to /catalogue: middleware redirects to /login

2. Write src/lib/prisma.test.ts:
   - Prisma client exports a singleton (same instance across requires)

3. Run: npm run test -- --run
   Expected: tests fail (modules do not exist yet). If all pass, stop and investigate.

--- GREEN ---
4. Create src/lib/auth.ts — NextAuth v5 + Auth0 provider + DEBUG_AUTH bypass as specified in SPEC.md §Auth.
5. Create src/lib/prisma.ts — Prisma client singleton.
6. Create src/app/api/auth/[...nextauth]/route.ts.
7. Create src/app/login/page.tsx — sign-in page with "Sign in with Google" button (bypassed when DEBUG_AUTH=true).
8. Create src/middleware.ts — protect /catalogue route, redirect unauthenticated to /login.
9. Run: npx prisma migrate dev --name init

10. Run: npm run test -- --run
    Expected: all tests pass.

--- VERIFY GATE ---
DEBUG_AUTH=true npm run dev
Visit http://localhost:3000 → should redirect to /login → click sign in → should reach /catalogue (404 is fine — route not built yet).
Do not proceed to Beat 3 if this redirect flow does not work.
```

---

## BEAT 3 — Sandbox app (target: 20 min)

```
Scaffold the sandbox product catalogue app in ./sandbox/.
Follow TDD: write tests first, confirm they fail, then implement.

--- RED ---
1. Write sandbox/src/components/ProductCard.test.tsx:
   - Renders product name, category, description, specs, and price
   - Shows a placeholder element (no <img>) when image prop is null
   - Shows an <img> with correct src when image prop is set

2. Run: cd sandbox && npm run test -- --run
   Expected: tests fail (ProductCard does not exist yet).

--- GREEN ---
3. Initialise a Next.js 15 project in ./sandbox/ with TypeScript and Tailwind (if not already done in Beat 1).
4. Copy the products seed data from SPEC.md into sandbox/src/data/products.ts.
   Set the image field for each product to /images/{id}-base.png (not null — base images are committed).
5. Create sandbox/src/components/ProductCard.tsx — renders name, category, description, specs, price, and image.
6. Create sandbox/src/app/page.tsx — responsive grid of ProductCard components from seed data.
7. Create sandbox/src/app/layout.tsx — minimal, clean.
8. Create sandbox/public/images/.gitkeep.
9. Create sandbox/Dockerfile (dev: node:20-alpine, npm run dev -- --port 3001).

10. Create src/app/baseline/page.tsx in the MAIN app:
    - No auth() check — public page.
    - Import products from sandbox/src/data/products.ts.
    - Light background (bg-zinc-50 / bg-white) — visual contrast with the dark main app.
    - Header: "Manifest — starting point" with subtitle "Six products. Studio shots. No features.
      This is what we give Codex." and a "Sign in to modify →" link to /login.
    - Responsive product grid using the same card layout as the sandbox.
    - Images served from sandbox/public/images/ — configure a Next.js rewrites rule:
        { source: '/_sandbox-images/:path*', destination: 'http://localhost:3001/images/:path*' }
      Reference images as /_sandbox-images/{id}-base.png on this page.
    - Footer: "Built with Codex in a 4-hour window."
    Update src/app/page.tsx to redirect to /baseline (not /catalogue).

11. Run: cd sandbox && npm run test -- --run
    Expected: all tests pass.

--- VERIFY GATE ---
cd sandbox && npm run dev -- --port 3001
npm run dev    (main app, port 3000)
Visit http://localhost:3000 → redirects to /baseline → 6-product grid visible with base images on a light background.
Visit http://localhost:3001 → same 6 products directly in the sandbox.
Do not proceed to Beat 4 if either grid does not render correctly.
```

---

## BEAT 4 — Codex App Server integration (target: 45 min)

```
This is the core runtime feature. Implement the App Server WebSocket bridge.
Follow TDD: write tests first in two groups (lib layer, then UI layer).

--- RED (lib layer) ---
1. Write src/lib/event-bus.test.ts:
   - emit/on round-trip: event emitted is received by listener with correct payload
   - Multiple listeners receive the same event

2. Write src/lib/codex-server.test.ts:
   - Mocks child_process.spawn
   - Confirms "initialize" JSON-RPC message is written to stdin on start
   - Parses a valid JSONL line from stdout and emits it on the event bus
   - Handles a malformed JSON line without throwing

3. Write src/lib/moderation.test.ts:
   - Mocks openai.moderations.create
   - Clean prompt (not flagged) → checkModeration resolves without throwing
   - Flagged prompt → checkModeration throws ModerationError with category names in message
   - Multiple flagged categories → all included in the error message

4. Run: npm run test -- --run
   Expected: tests fail (modules do not exist yet).

--- GREEN (lib layer) ---
5. Create src/lib/event-bus.ts — Node EventEmitter singleton.
6. Create src/lib/codex-server.ts — spawns `codex app-server` as child process using stdio transport, parses JSONL from stdout, emits events on the event bus. See SPEC.md §Codex App Server integration for the exact implementation.
7. Create src/lib/moderation.ts — checkModeration(input) function and ModerationError class. See SPEC.md §Moderation for exact implementation.

8. Run: npm run test -- --run
   Expected: lib layer tests all pass.

--- RED (UI layer) ---
9. Write src/components/AgentStream.test.tsx:
   - Renders empty state message when no events present
   - Renders an agentMessage event as a readable text bubble
   - Renders a fileChange event with filename and status badge
   - Renders a commandExecution event with monospace command text

10. Run: npm run test -- --run
    Expected: AgentStream tests fail (component does not exist yet). Lib tests still green.

--- GREEN (UI layer) ---
11. Create src/app/api/ws/route.ts — WebSocket bridge:
    - Accepts browser WebSocket connections
    - On connection: sends App Server initialize + initialized
    - Starts the App Server if not already running (singleton, cwd: ./sandbox)
    - Subscribes to event bus, forwards events to connected WebSocket clients
    - On inbound feature request text: call checkModeration — if flagged, send { error, flagged: true } back to client; otherwise forward to App Server stdin as a turn/start message

12. Create src/app/api/transcribe/route.ts — POST: auth check, extract `audio` File from FormData,
    call `openai.audio.transcriptions.create({ file, model: "whisper-1" })`, return `{ text }`.

13. Create src/components/FeatureRequest.tsx — text input + submit button + push-to-record mic button.
    Connects to /api/ws. Placeholder: "Describe a feature — it ships."
    Push-to-record behaviour (see SPEC.md §Transcription):
    - mousedown/touchstart: getUserMedia, start MediaRecorder, button → rose-500 + animate-pulse
    - mouseup/touchend: stop recorder, POST blob to /api/transcribe, populate input with text
    - Feature-detect MediaRecorder on mount; hide mic button if unsupported
    Shows inline error when response has flagged: true.

14. Create src/components/AgentStream.tsx — subscribes to WebSocket, renders events:
    - agentMessage → readable text bubble (border-l-2 border-indigo-500)
    - fileChange → filename badge + status (border-l-2 border-amber-400)
    - commandExecution → monospace command + exit code (border-l-2 border-zinc-500)
    - plan → formatted list (border-l-2 border-indigo-500)
    - turn/completed success → border-l-2 border-emerald-500
    - Any error → border-l-2 border-rose-500
    - Other events → grey pill with event type
    Items fade in with translate-y-1 → translate-y-0 (Tailwind transition 200ms, staggered 40ms).

15. Create src/app/catalogue/page.tsx — three-tab layout (App | Agent | Debug):
    - App tab: iframe → /sandbox-preview/ (NOT localhost:3001 directly — use the Next.js proxy path
      so it works on both local and Fly.io). On fileChange event: pulse iframe wrapper amber ring 600ms.
      On turn/completed: setTimeout 1500ms then reload iframe (sandboxIframeRef.current.src = sandboxIframeRef.current.src).
      This gives true HMR locally (Next.js picks up changes mid-turn) and a clean full reload on Fly.io.
    - Agent tab: FeatureRequest + AgentStream
    - Debug tab: placeholder ("Debug panel coming in Beat 7")
    - Requires session (auth check).

16. Run: npm run test -- --run
    Expected: all tests pass.

--- VERIFY GATE (hard gate) ---
Run locally (not Docker — the live App Server requires the codex binary installed on your machine):
  Tab 1: npm run dev          (main app, port 3000)
  Tab 2: cd sandbox && npm run dev -- --port 3001   (sandbox, port 3001)
  codex must be installed: npm i -g @openai/codex

Sign in → navigate to /catalogue → type a feature request in the Agent tab → submit.
You must see App Server events appearing in the AgentStream panel.
If this gate is not met: do not proceed to Beat 5. Fix the issue using the buffer time.

Note on production: the Dockerfile installs @openai/codex globally (RUN npm install -g @openai/codex)
and Fly.io secrets include CODEX_API_KEY so the App Server runs headlessly in production via API key
auth. Hot-reload in the sandbox iframe is not available in production (no dev server) — the Debug
panel diff view shows file changes instead.

Graceful fallback: if spawn("codex") fails (binary not found — e.g. evaluator running locally without
Codex installed), codex-server.ts must catch the error and emit { type: "app-server-unavailable" }
on the event bus. FeatureRequest shows the "App Server not running" warning banner (Beat 8).

Contingency: if this beat is running past 50 min, split here. Complete the lib layer (steps 1–8) and move the UI layer (steps 9–15) to a Beat 4b. Budget: +20 min. Do not skip the gate.
```

---

## BEAT 5 — Thread persistence + rollback (target: 20 min)

```
Persist Codex threads and feature requests to the database. Add rollback support.
Follow TDD: write tests first, confirm they fail, then implement.

--- RED ---
1. Write src/app/api/threads/route.test.ts:
   - GET without session → 401
   - GET with session → 200, returns array of threads (mock Prisma)
   - POST without session → 401
   - POST with session + threadId → 200, creates Thread record

2. Write src/app/api/rollback/route.test.ts:
   - POST without session → 401
   - POST with session → calls thread/rollback on App Server, runs git reset, returns { message }

3. Write src/app/api/reset/route.test.ts:
   - POST without session → 401
   - POST with session → calls `git reset --hard baseline` in sandbox, calls `restartAppServer`, returns { message }
   (Mock `execSync` and `restartAppServer`.)

4. Run: npm run test -- --run
   Expected: new tests fail (routes do not exist yet).

--- GREEN ---
5. Create src/app/api/threads/route.ts:
   - GET: list threads for current user (newest first, include feature count)
   - POST: create a new Thread record (called when App Server emits thread/started)

6. Update src/app/api/ws/route.ts (WebSocket bridge):
   - On thread/started event: POST to /api/threads with the thread ID
   - On turn/completed event: update the Feature record with diff (from accumulated fileChange events); run:
     execSync('git add -A && git commit -m "turn:{turnId} thread:{threadId}"', { cwd: './sandbox' })

7. Create src/app/api/rollback/route.ts (POST):
   - Auth check: session required → 401 if missing
   - Send thread/rollback to App Server (removes last turn from context)
   - Run: execSync('git reset --hard HEAD~1', { cwd: './sandbox' })
   - Update Feature record status to "rolled_back"
   - Return: { message: "Rolled back to previous state" }

8. Create src/app/api/reset/route.ts (POST):
   - Auth check: session required → 401 if missing
   - Run: execSync('git reset --hard baseline', { cwd: './sandbox' })
     (The "baseline" tag was created in Beat 1 — this always resets to the clean initial state
      regardless of how many commits have accumulated.)
   - Call restartAppServer(sandboxDir) so the next feature request starts a fresh thread
   - Return: { message: "Sandbox reset to baseline" }
   Export restartAppServer from codex-server.ts (kill current proc + call startAppServer).

9. Create src/components/ThreadHistory.tsx — sidebar listing past sessions with summary and date.
   On rollback: iframe wrapper pulses with orange ring for 400ms (distinct from amber hot-reload ring).

10. Wire ThreadHistory into the catalogue layout.

11. Run: npm run test -- --run
    Expected: all tests pass.

--- VERIFY GATE ---
docker compose up → sign in → submit a feature request.
Thread must appear in ThreadHistory sidebar.
Click "Undo" → sandbox files must revert + hot-reload must fire (orange ring flash visible).
Do not proceed to Beat 6 if rollback does not work end-to-end.
```

---

## BEAT 6 — Image generation (target: 25 min)

```
$scaffold-feature

Add product image generation using the OpenAI Images API.
Follow TDD: write tests first, confirm they fail, then implement.

--- RED ---
1. Write src/app/api/images/generate/route.test.ts:
   - POST without session → 401
   - POST with flagged context text → 400 with { error, flagged: true } (mock checkModeration to throw ModerationError)
   - POST with valid inputs → calls openai.images.edit with correctly formed prompt, writes file, returns { url, filename }
   (Mock checkModeration, openai.images.edit, writeFile, readFile.)

2. Write src/components/ImageModal.test.tsx:
   - Renders product name in header
   - Left panel always shows base image src (/images/{productId}-base.png)
   - Right panel shows placeholder before generation
   - "Generate" button calls POST /api/images/generate
   - On success: right panel shows generated image
   - On moderation block: shows inline error message, inputs intact
   - "Use this image" button fires a postMessage to the sandbox iframe

3. Run: npm run test -- --run
   Expected: new tests fail.

--- GREEN ---
4. Create src/app/api/images/generate/route.ts as specified in SPEC.md §Image generation.
   The route must call checkModeration(context + " " + style) before calling images.edit.
   Return 400 with { error, flagged: true } if ModerationError is thrown.

5. Create src/components/ImageModal.tsx — Dialog (shadcn/ui) with before/after layout:
   - Header: product name
   - Left panel: base image (/images/{productId}-base.png) — always visible
   - Right panel: grey gradient placeholder until generated, then the lifestyle result (opacity-0 → opacity-100 300ms)
   - "Setting / mood" free text input
   - Style selector: "Lifestyle scene" | "In use"
   - Generate button → POST /api/images/generate → right panel shows result
   - "Use this image" button → postMessage to sandbox iframe with { type: "useImage", productId, url }

6. Add a "Generate image" button to sandbox/src/components/ProductCard.tsx.
   The sandbox listens for the useImage postMessage and updates the product's image src in state.

7. Run: npm run test -- --run
   Expected: all tests pass.

--- VERIFY GATE ---
docker compose up → sign in → click "Generate image" on a product card.
Before/after modal must open. Type a context ("draped over a reading chair, afternoon light"), click Generate.
Lifestyle image must appear in right panel. Click "Use this image" → product card in the iframe must update.
Do not proceed to Beat 7 if the before/after flow does not work.
```

---

## BEAT 7 — Debug panel (target: 20 min)

```
$scaffold-feature

Implement the Debug tab and /debug/[threadId] standalone route.
Follow TDD: write tests first, confirm they fail, then implement.

--- RED ---
1. Write src/components/DebugPanel.test.tsx:
   - Renders each event as a collapsed row showing timestamp, event type, and payload preview
   - Clicking a row expands to show full JSON in a <pre> block; clicking again collapses
   - fileChange events show a simple +/- unified diff in the expanded view
   - Header shows thread ID and token usage count
   - "Copy session log" button calls navigator.clipboard.writeText with the full event array as JSON
   - "Undo last change" button calls POST /api/rollback; on success shows a toast; disabled when no turns exist
   - "Reset to baseline" button is always enabled (styled text-orange-400)
   - Clicking "Reset to baseline" opens an AlertDialog with the warning text
   - Confirming the AlertDialog calls POST /api/reset and shows a success toast
   - Cancelling does not call the route

2. Run: npm run test -- --run
   Expected: DebugPanel tests fail.

--- GREEN ---
3. Create src/components/DebugPanel.tsx per the SPEC.md §Debug panel spec.
   Use font-mono text-xs for event rows. Token counter uses tabular-nums.
   Diff rendering: simple line-by-line — lines starting with + in emerald, - in rose, no library needed.
   Include both action buttons in the DebugPanel header:
   - "Undo last change" (text-zinc-400, disabled when no turns) → POST /api/rollback
   - "Reset to baseline" (text-orange-400, always enabled) → shadcn/ui AlertDialog → POST /api/reset
   After successful reset: show toast, then reload the sandbox iframe (sandboxRef.current.src = sandboxRef.current.src).

4. Wire DebugPanel into the Debug tab in catalogue/page.tsx (replace placeholder from Beat 4).

5. Create GET /api/threads/[id]/events/route.ts — returns the event log for a given thread ID.

6. Create src/app/debug/[threadId]/page.tsx — standalone shareable view of a session's event log.
   Loads events from GET /api/threads/[id]/events. Useful as a shareable URL for evaluators.

7. Run: npm run test -- --run
   Expected: all tests pass.

--- VERIFY GATE ---
docker compose up → sign in → submit a feature request → switch to Debug tab.
Events must show as collapsed rows with timestamps.
Click a row → full JSON must expand.
Token counter in the header must update as events arrive.
Do not proceed to Beat 8 if the Debug tab is not functional.
```

---

## BEAT 8 — Polish + error states (target: 20 min)

```
Polish the UI and add missing error/empty states.
Follow AGENTS.md §Visual design for all colour and motion choices.

1. Empty states:
   - No threads yet → ThreadHistory shows "No sessions yet. Describe a feature to get started."
   - App Server not running → FeatureRequest shows a warning banner with reconnect button
   - No image yet → ProductCard shows grey gradient placeholder with product name overlay

2. Error handling:
   - WebSocket disconnect → AgentStream shows "Connection lost. Reconnect?" with button
   - Image generation failure → ImageModal shows error message, keeps inputs intact
   - Turn failure (turn/completed with error field) → AgentStream shows red error state (border-l-2 border-rose-500)
   - Moderation block on feature request → FeatureRequest shows inline "That prompt can't be used — please try different wording."

3. Loading states:
   - Submitting feature request → input disabled + spinner (animate-pulse on button)
   - Image generating → right panel shows animated skeleton

4. Visual polish — follow AGENTS.md §Visual design exactly:
   - Dark mode default (bg-zinc-950 base), ThemeProvider with system preference toggle
   - Responsive layout (catalogue works on mobile width)
   - Consistent use of shadcn/ui Badge, Button, Card
   - Add hot-reload amber ring pulse keyframe to globals.css:
     @keyframes ring-pulse-amber { 0%,100% { box-shadow: 0 0 0 0 rgb(251 191 36 / 0) } 50% { box-shadow: 0 0 0 3px rgb(251 191 36 / 0.6) } }
   - Add rollback orange ring keyframe (distinct from amber):
     @keyframes ring-pulse-orange { 0%,100% { box-shadow: 0 0 0 0 rgb(249 115 22 / 0) } 50% { box-shadow: 0 0 0 3px rgb(249 115 22 / 0.6) } }
   - Apply amber keyframe to iframe wrapper on fileChange; orange keyframe on rollback (600ms, 400ms respectively)

5. Run: npm run test -- --run && npm run build
   Expected: all tests green, build clean with no TypeScript errors.

GATE: docker compose up → full end-to-end:
- Dark mode correct (zinc-950 background)
- Amber ring pulse visible on hot-reload after feature request
- Empty state visible in ThreadHistory before first request
- FeatureRequest placeholder reads "Describe a feature — it ships."
```

---

## BEAT 9 — Fly.io deploy (target: 20 min)

```
Deploy to Fly.io and verify the live app.

1. Create fly.toml for the main app (if not already created by fly launch):
   - app = "<your-app-name>"
   - primary_region = "lhr"  (London, appropriate for UK-based role)
   - [build] dockerfile = "Dockerfile"
   - [[services]] internal_port = 3000
   - [mounts] source = "data_vol", destination = "/app/data"

2. Create Dockerfile (production build) per SPEC.md §Dockerfile:
   - Builder stage: npm ci + npm run build + cd sandbox && npm ci
   - Runner stage: npm install -g @openai/codex (for headless App Server)
   - Copy .next, public, node_modules, package.json, prisma, sandbox
   - CMD: concurrently runs "npm start" and "cd /app/sandbox && npm run dev -- --port 3001 --hostname 127.0.0.1"
   - This gives full feature parity on Fly.io: App Server runs via CODEX_API_KEY,
     sandbox dev server runs internally, iframe reloads on turn/completed.

3. Verify secrets are set: fly secrets list
   Required: OPENAI_API_KEY, CODEX_API_KEY (same value as OPENAI_API_KEY — used by codex binary
   for headless auth), NEXTAUTH_SECRET, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_ISSUER
   NEXTAUTH_URL should be https://<app>.fly.dev
   DEBUG_AUTH must NOT be set or must be "false"

4. Deploy: fly deploy

5. After deploy: fly open → verify sign in works with Google → verify app loads.

Note: The sandbox hot-reload (port 3001 iframe) will not work in production. The App tab should gracefully show "Live preview available in local development only" when the sandbox URL is unreachable, and fall back to showing the diff view.
```

---

## BEAT 10 — Final checks + $ship-it (target: 20 min)

```
$ship-it

Final checks before Loom recording:
1. npm run test -- --run (all green)
2. npm run build (no errors)
3. Local run: npm run dev + sandbox npm run dev -- --port 3001 → full end-to-end works
4. Fly.io URL accessible, Google sign-in works

5. Create LICENSE file (MIT):
   MIT License
   Copyright (c) 2026 Steven Thwaites
   [standard MIT body]

6. Write README.md with:
   a) Dictionary tagline at the top:
      > **man·i·fest** /ˈmanɪfɛst/
      >
      > *verb* — to make evident or certain by showing or displaying; to appear plainly
      >
      > *noun* — a document giving a list of the cargo, crew, and passengers of a ship
      ---
      A self-modifying product catalogue. Describe a feature in plain English.
      Watch Codex write the code, run the tests, and hot-reload the result in front of you.

   b) Quick start section:
      npm run dev              # main app on port 3000
      cd sandbox && npm run dev -- --port 3001   # sandbox on port 3001
      docker compose up        # both services (without live App Server)
      npm i -g @openai/codex   # required for live App Server

   c) Mermaid app architecture diagram:
      ```mermaid
      graph LR
        subgraph Browser
          A[Catalogue iframe]
          B[Agent stream panel]
        end
        subgraph MainApp[Main App :3000]
          C[WebSocket bridge /api/ws]
          D[Auth / sessions]
          E[Image generation /api/images]
        end
        subgraph CodexAS[Codex App Server]
          F[codex app-server]
        end
        subgraph Sandbox[Sandbox :3001]
          G[Next.js dev server]
          H[Source files]
        end
        B -- WebSocket --> C
        C -- stdio JSON-RPC --> F
        F -- writes files --> H
        H -- hot-reload --> G
        G -- iframe --> A
        E --> I[OpenAI gpt-image-2]
        D --> J[(Prisma / SQLite)]
      ```

7. Write ARCHITECTURE.md with a CI pipeline diagram:
   ```mermaid
   graph TD
     A["Jira ticket\nlabel: codex-ready"] -->|Jira Automation webhook| B[GitHub Action]
     B -->|codex exec --non-interactive| C[Codex]
     C -->|commits fix| D[Feature branch]
     D -->|PR opened| E[Pull Request]
     E -->|auto-fills .github/pull_request_template.md| F[PR review]
     F -->|approved| G[main branch]
     G -->|fly deploy| H[Fly.io]
     E -->|transitions ticket| A
   ```
   Include a paragraph describing the diagram: "This mirrors the canonical Codex + Jira
   integration pattern. The PR template (see .github/) captures the Codex thread ID and
   original feature prompt so every machine-written PR is auditable."

8. Create .github/ISSUE_TEMPLATE/feature_request.md (from the template in the repo — see
   part2-demo-app root for .github/ISSUE_TEMPLATE/feature_request.md if it already exists).
   If not present, write it with: name, about, labels: codex-ready, fields: What/Why/Acceptance criteria/Technical notes/Out of scope.

9. Create .github/ISSUE_TEMPLATE/bug_report.md with: name, about, labels: bug, fields: Describe/Steps to reproduce/Environment/Relevant output.

10. Create .github/pull_request_template.md with: What changed/How it was tested checklist/Codex context (Thread ID + prompt)/Screenshots.

11. Commit everything:
    git add LICENSE README.md ARCHITECTURE.md .github/
    git commit -m "chore: add LICENSE, README with architecture, GitHub templates"

12. Create public GitHub repository named "manifest-codex-demo". Push all commits.
    git push origin main
```

---

## BUFFER (20 min)

Reserved for: fixing anything that failed a VERIFY GATE in Beats 1–9, last-minute polish, Loom setup.

Do not start the Loom until Beat 10 is complete and docker compose up runs cleanly.

---

## POST-BUILD — Quality refinement with Goals API

*Run this after the 4h window, before recording the Loom. Not time-boxed.*

The Goals API lets Codex evaluate an evidence-based objective after every turn and continue autonomously until the finish line is met. This is the right tool for post-build quality refinement — set the goal, step away, come back to a clean codebase.

### Goal: test coverage and type correctness

```
Set the following goal on a new thread:

"Keep all Vitest tests passing (npm run test -- --run exits 0) and keep the TypeScript build clean
(npm run build exits 0). After every change, run both checks. Continue fixing issues — type
errors, failing tests, missing test cases for any uncovered routes or components — until both
commands exit 0 with no warnings. Do not add new features. Do not change behaviour. Only fix,
refactor, and cover."

tokenBudget: 80000
```

App Server call (paste into a Codex session with the App Server running):
```json
{ "method": "thread/goal/set", "id": 1, "params": {
    "threadId": "<active-thread-id>",
    "objective": "Keep all Vitest tests passing (npm run test -- --run exits 0) and keep the TypeScript build clean (npm run build exits 0). After every change, run both checks. Continue fixing issues — type errors, failing tests, missing test cases for any uncovered routes or components — until both commands exit 0 with no warnings. Do not add new features. Do not change behaviour. Only fix, refactor, and cover.",
    "tokenBudget": 80000
  }
}
```

### What to expect

Codex will:
1. Run `npm run test -- --run` and `npm run build` to establish the baseline
2. Identify every failing test and every TypeScript error
3. Fix them one by one, running checks after each fix
4. When both commands exit 0 with no warnings, mark the goal `completed`

The goal status updates arrive as `thread/goal/updated` events on the stream — you can watch progress in the Debug tab if the App Server is running, or just check back after 10–15 minutes.

### Loom mention (15 seconds in the "what I'd add" or "how I built this" beat)

> "After the build window I used the Goals API to lock in quality — I set 'keep all tests green
> and the build clean' as a persistent objective and Codex ran autonomously until both checks
> passed. That's the compounding effect: the codebase gets easier to work in over time."
