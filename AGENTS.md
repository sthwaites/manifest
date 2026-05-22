# AGENTS.md — Manifest

## Build and test commands

```bash
npm run dev          # start main app on port 3000
npm run build        # production build
npm run test         # Vitest watch mode
npm run test -- --run  # Vitest single run (use in CI and before committing)
npx prisma migrate dev --name <name>   # run a DB migration
npx prisma generate  # regenerate Prisma client after schema changes
npx prisma db seed   # seed the database

cd sandbox && npm run dev -- --port 3001  # start sandbox app
```

## Repo layout

- `src/` — main Next.js app (auth, API, UI)
- `src/lib/` — shared utilities: `prisma.ts`, `auth.ts`, `codex-server.ts`, `event-bus.ts`
- `src/app/api/` — Next.js API routes
- `src/components/` — React components
- `sandbox/` — the product catalogue sub-app Codex rewrites
- `prisma/` — schema and migrations
- `data/` — SQLite database file (Docker volume, not committed)
- `public/` — static assets for main app
- `sandbox/public/images/` — AI-generated product images land here

## Code conventions

- TypeScript strict mode. No `any`. No `ts-ignore`.
- Tailwind CSS for all styling. No CSS modules, no inline styles.
- shadcn/ui for interactive components (Button, Dialog, Tabs, Badge).
- Server Components by default. Mark client components with `"use client"` only when needed (event handlers, useEffect, browser APIs).
- Use `auth()` from `src/lib/auth.ts` for session checks in Server Components and API routes.
- Prisma queries in `src/lib/` helpers or route handlers — never inline in components.
- Environment variables accessed only in server-side code (API routes, Server Components, lib).

## Naming

- Components: PascalCase, one component per file
- Utilities: camelCase
- Files: kebab-case for routes and pages, PascalCase for component files
- Prisma models: PascalCase as defined in schema

## Working with the Codex App Server

- App Server is spawned in `src/lib/codex-server.ts`. Do not spawn it elsewhere.
- All stdio communication goes through `event-bus.ts`. Components subscribe via WebSocket (`/api/ws`).
- `workspaceWrite` policy is scoped to the `sandbox/` directory. Never give write access outside it.
- Thread IDs from App Server are stored in the `Thread` model. Always persist them.
- If App Server emits an event you do not recognise, log it to the debug event bus and continue — do not throw.

## Testing discipline

- Every new util in `src/lib/` needs a corresponding `.test.ts` file.
- Every new API route needs a `.test.ts` with at minimum: unauthenticated → 401, happy path → 200.
- Every new component that handles events or state needs a `.test.tsx`.
- Run `npm run test -- --run` before considering any task complete.
- Use `vi.mock` for: OpenAI client, Prisma client, `child_process.spawn`, `fs/promises`.
- Do not mock Next.js internals. Use `@testing-library/react` for component tests.
- **TDD discipline**: for every new `src/lib/` module or API route, write the test file first. Run `npm run test -- --run` to confirm the tests fail before implementing. A module is not started until its failing tests exist.

## Plans.md

For any task requiring more than 3 file changes:
1. Write `plans.md` in the repo root with: goal, approach, files to change, steps.
2. Update the "Progress" section after completing each step.
3. Leave `plans.md` in the repo — it's a useful audit trail.

## Commit discipline

- Commit after each logical unit of work (one feature, one fix, one test suite).
- Message format: `type(scope): short description` — e.g. `feat(auth): add Auth0 Google provider`
- Types: `feat`, `fix`, `test`, `refactor`, `chore`
- Never commit: `.env.local`, `data/dev.db`, `sandbox/public/images/*.png`, `node_modules/`
- When opening a PR (via `$ship-it` or manually), use `.github/pull_request_template.md` — fill in the Codex context section with the thread ID and the original feature request prompt.

## Branch naming

`feature/<slug>` — e.g. `feature/agent-stream-panel`
Work directly on `main` for the 4-hour build window unless specifically branching a major feature.

## Do not touch

- `prisma/schema.prisma` account/session/verificationToken models — managed by NextAuth adapter
- `sandbox/.next/` — build output, ignored
- `data/` — database files, not committed

## Visual design

Default: dark mode (zinc-950 base). Light mode via ThemeProvider with system preference detection.

Colour tokens — use Tailwind class names, not hex values:
- Background: `bg-zinc-950`
- Surface (cards, panels): `bg-zinc-900`
- Elevated (dropdowns, modals): `bg-zinc-800`
- Border: `border-zinc-700`
- Muted text: `text-zinc-400`
- Body text: `text-zinc-50`
- Accent (buttons, active states, links): `indigo-500`
- Warm (file changes, hot-reload flash, undo): `amber-400`
- Success (tests passing, turn completed): `emerald-500`
- Error (turn failure, moderation block): `rose-500`

Motion rules:
- All transitions: 150–300ms ease-out. Tailwind `transition` classes only — no Framer Motion.
- Agent stream events: `opacity-0 → opacity-100` + `translate-y-1 → translate-y-0`, 200ms, staggered 40ms per item.
- Hot-reload flash: amber ring pulse on iframe wrapper — CSS keyframe in `globals.css` (`ring-2 ring-amber-400` pulse 600ms).
- Rollback flash: orange ring pulse, visually distinct from hot-reload (`ring-2 ring-orange-500` 400ms).
- Image generation result: right panel `opacity-0 → opacity-100` 300ms.
- Never animate for decoration — only to communicate state change.

AgentStream event border colours:
- `agentMessage`, `plan`, `reasoning`: `border-l-2 border-indigo-500`
- `fileChange`: `border-l-2 border-amber-400`
- `commandExecution`: `border-l-2 border-zinc-500`
- `turn/completed` success: `border-l-2 border-emerald-500`
- Any error: `border-l-2 border-rose-500`

The sandbox iframe always has a white/light background — the visual contrast between the dark main app and the light catalogue iframe makes hot-reload changes read immediately.

## Browser verification (Playwright MCP + chrome_devtools MCP)

The `playwright` and `chrome_devtools` MCP servers are available. Use them to self-verify after implementing a feature.

Use Playwright MCP first for repeatable browser checks:
- Navigate to local pages such as `http://localhost:3000/baseline` and `http://localhost:3000/catalogue`
- Click, type, and submit forms using role/name-based interactions
- Use accessibility snapshots to confirm the UI structure
- Use testing assertions to confirm visible text, controls, and form values
- Use storage state when a verified login/session needs to persist across checks

Use Chrome DevTools MCP for inspection and debugging:
- `list_console_messages` — check for errors or warnings after navigating to the feature
- `take_screenshot` — visually confirm the feature rendered as expected
- `list_network_requests` — confirm API calls are firing and returning expected status codes
- `evaluate_script` — inspect DOM state or run assertions in the page context

Prefer Playwright assertions + Chrome DevTools console checks over purely relying on unit tests for visual components.

## Definition of done (per task)

A task is done when:
1. `npm run test -- --run` passes (all tests green)
2. `npm run build` succeeds with no TypeScript errors
3. The feature works in the browser — verified with Playwright MCP assertions and Chrome DevTools console checks
