# Contributing

## Setup

Use Node 20 and install dependencies in both apps.

```bash
npm ci
cd sandbox && npm ci
cd ..
npx prisma generate
npx prisma migrate dev
```

Copy `.env.example` to `.env.local`. Keep secrets out of git.

## Development Workflow

- Run the main app with `npm run dev` on port `3000`.
- Run the sandbox with `cd sandbox && npm run dev -- --port 3001`.
- Keep source changes scoped to the main app, sandbox app, or Prisma layer that owns the behavior.
- Prefer Server Components unless a component needs browser APIs, local state, effects, or event handlers.
- Use Tailwind classes for styling.
- Keep generated runtime files, local databases, and generated images untracked.

## Tests

Before opening a pull request, run:

```bash
npm run test -- --run
npm run build
cd sandbox && npm run test -- --run
cd sandbox && npm run build
```

Add focused tests for new API routes, stateful components, and shared utilities.

## Commit Style

Use concise Conventional Commit-style messages:

```text
feat(agent): add streamed tool call events
fix(reset): clean untracked sandbox files
docs: clarify local setup
```

## Pull Requests

Include a short summary, testing notes, and screenshots for visible UI changes. Mention any migration, environment variable, or manual setup requirement.
