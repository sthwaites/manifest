---
name: scaffold-feature
description: Use when adding a Manifest feature that touches app code, routes, stateful UI, or persistence. Enforces the repo's RED -> GREEN -> VERIFY workflow and keeps implementation scoped to the current beat.
---

# Scaffold Feature

Use this skill for each build beat that creates or changes product behavior.

## Workflow

1. Read `SPEC.md`, `AGENTS.md`, and the current beat in `prompts/build-sequence.md`.
2. Identify the smallest behavior slice required by the beat.
3. Write the failing tests first:
   - `src/lib/*.test.ts` for utilities.
   - `src/app/api/**/route.test.ts` for API routes.
   - `src/components/*.test.tsx` for interactive components.
   - `sandbox/src/**/*.test.tsx` for sandbox UI.
4. Run the relevant test command and confirm the new tests fail for the expected reason.
5. Implement only the code needed to make those tests pass.
6. Run `npm run test -- --run`.
7. Run the beat's manual verify gate before moving on.

## Constraints

- Run commands from `part2-demo-app/` unless the beat explicitly says `cd sandbox`.
- Keep Codex App Server writes scoped to `./sandbox`.
- Do not set or commit real secrets.
- Do not skip the hard gate in Beat 4; the event stream must work before persistence/polish work.
