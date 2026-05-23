# Manifest Build Plan

## Goal

Build the local Manifest demo app from `SPEC.md` and `prompts/build-sequence.md`, prioritising the local development flow on ports 3000 and 3001.

## Approach

Work through the build beats in order, keeping each step testable. Start with the main Next.js app, sandbox catalogue, Prisma schema, and baseline page, then proceed to auth, App Server streaming, persistence, rollback/reset, image generation, and browser verification.

## Files to Change

- `package.json`, TypeScript, Next, Vitest, Tailwind, Docker, and Prisma config
- `src/app/**`, `src/components/**`, `src/lib/**`
- `sandbox/**`
- `prisma/schema.prisma`

## Steps

1. Bootstrap main app and sandbox project structure.
2. Add product seed data, baseline page, and sandbox catalogue UI.
3. Install dependencies and generate Prisma client.
4. Run tests/build and fix bootstrap issues.
5. Continue through auth, App Server streaming, persistence, rollback/reset, image generation, and browser verification.
6. Implement Beat 4 lib layer: event bus, Codex App Server process wrapper, moderation.
7. Implement Beat 4 UI layer: WebSocket-backed feature request, AgentStream, and catalogue tabs.
8. Implement Beat 5 persistence routes: threads, rollback, reset.
9. Implement Beat 6 image generation route, before/after modal, and sandbox image update flow.
10. Implement Beat 7 debug event log panel and standalone debug route.
11. Implement Beat 8 polish and error states.
12. Initialise sandbox Git baseline and keep SQLite data under root `data/`.

## Progress

- [x] Initial worktree committed before changes.
- [x] Bootstrap main app and sandbox project structure.
- [x] Add product seed data, baseline page, and sandbox catalogue UI.
- [x] Install dependencies and generate Prisma client.
- [x] Run tests/build and fix bootstrap issues.
- [x] Beat 4 lib tests written and confirmed red.
- [x] Beat 4 lib implementation passing.
- [x] Beat 4 UI tests and implementation passing.
- [x] Beat 5 API route tests written and confirmed red.
- [x] Beat 5 API routes passing.
- [x] Beat 6 image generation tests written and confirmed red.
- [x] Beat 6 image generation implementation passing.
- [x] Beat 7 debug panel tests written and confirmed red.
- [x] Beat 7 debug panel implementation passing.
- [x] Beat 8 polish/error-state tests passing.
- [x] Sandbox Git baseline initialised and tagged.
