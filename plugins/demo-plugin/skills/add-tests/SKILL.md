---
name: add-tests
description: Use when adding or repairing test coverage for Manifest utilities, API routes, stateful components, and sandbox catalogue behavior.
---

# Add Tests

Add focused tests for the behavior under change.

- Utilities: Vitest unit tests.
- API routes: unauthenticated `401` plus happy path.
- Components: React Testing Library and `user-event`.
- Sandbox UI: component tests under `sandbox/src/`.

Mock OpenAI, Prisma, child processes, and filesystem calls. Prefer behavior assertions.
