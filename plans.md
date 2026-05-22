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

## Progress

- [x] Initial worktree committed before changes.
- [x] Bootstrap main app and sandbox project structure.
- [x] Add product seed data, baseline page, and sandbox catalogue UI.
- [x] Install dependencies and generate Prisma client.
- [x] Run tests/build and fix bootstrap issues.
