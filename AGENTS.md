# Repository Guidelines

## Project Structure & Module Organization

This repository contains the Manifest Next.js app plus a mutable sandbox app. Main app code lives in `src/`: routes under `src/app`, reusable UI under `src/components`, shared utilities under `src/lib`, and type augmentations under `src/types`. Tests are colocated as `*.test.*`.

Prisma schema and migrations live in `prisma/`. Seed inputs are in `seed/`, operational scripts in `scripts/`, and the sandbox catalogue app in `sandbox/` with its own `src/`, tests, and build pipeline. Static sandbox assets live under `sandbox/public/`.

## Build, Test, and Development Commands

- `npm ci && npm --prefix sandbox ci`: install dependencies for both apps.
- `npx prisma migrate deploy && npx prisma generate`: apply migrations and generate Prisma Client.
- `npm run dev:local`: start the main app and sandbox together.
- `npm run dev`: start only the main app on port `3000`.
- `npm --prefix sandbox run dev -- --port 3001`: start only the sandbox app.
- `npm run lint`, `npm run typecheck`, `npm run test:run`: run ESLint, TypeScript checks, and main Vitest tests.
- `npm run verify`: run lint, typecheck, audit, tests, and production builds for both apps.

## Coding Style & Naming Conventions

Use TypeScript, React 19, Next.js App Router, and Tailwind CSS. Prefer Server Components unless browser APIs, state, effects, or event handlers are required. Keep route handlers in `src/app/api/**/route.ts`, pages in `page.tsx`, and component files in PascalCase, for example `CatalogueWorkspace.tsx`. Use camelCase for functions and variables.

## Testing Guidelines

Vitest, Testing Library, `jsdom`, and `vitest.setup.ts` support the test suite. Place focused tests next to the code they cover, using names like `src/lib/auth.test.ts` or `src/components/ImageStudio.test.tsx`. Add tests for API routes, stateful UI, persistence utilities, and rollback/reset behavior.

## Commit & Pull Request Guidelines

Use concise Conventional Commit-style messages, matching history such as `feat: show products on title page`, `fix: stabilize feature request socket`, and `chore: tidy local runtime docs`. Include an optional scope when helpful, for example `fix(reset): clean sandbox state`.

Pull requests should include a short summary, testing notes, linked issues when applicable, and screenshots for visible UI changes. Call out Prisma migrations, env var changes, Docker/runtime impacts, and manual setup.

## Security & Configuration Tips

Copy `.env.example` to `.env` or `.env.local` and keep secrets out of git. `OPENAI_API_KEY`, `CODEX_API_KEY`, `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are required for full local operation. Use `DEBUG_AUTH=true` for no-OAuth development; disable it when testing Auth0.
