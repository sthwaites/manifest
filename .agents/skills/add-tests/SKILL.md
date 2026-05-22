---
name: add-tests
description: Use when adding or repairing test coverage for Manifest utilities, API routes, stateful components, and sandbox catalogue behavior.
---

# Add Tests

Use this skill when coverage is missing, a regression needs to be pinned down, or a beat requires a RED phase.

## Test Targets

- Utilities in `src/lib/`: unit tests with Vitest, using `vi.mock` for external services and child processes.
- API routes in `src/app/api/`: at minimum unauthenticated `401` and happy-path success.
- Stateful UI components in `src/components/`: React Testing Library with `@testing-library/user-event`.
- Sandbox UI in `sandbox/src/`: component tests for rendering and interactions.

## Mocking Rules

- Mock OpenAI client calls, Prisma, `child_process.spawn`, `child_process.execSync`, and filesystem calls.
- Do not mock Next.js internals unless there is no stable public test seam.
- Prefer behavior assertions over implementation details.

## Done

- The new test fails before implementation when used in a RED phase.
- `npm run test -- --run` passes from `part2-demo-app/`.
- For sandbox-only changes, `cd sandbox && npm run test -- --run` also passes.
