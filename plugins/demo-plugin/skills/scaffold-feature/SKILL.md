---
name: scaffold-feature
description: Use when adding a Manifest feature that touches app code, routes, stateful UI, or persistence. Enforces the repo's RED -> GREEN -> VERIFY workflow and keeps implementation scoped to the current beat.
---

# Scaffold Feature

Use this skill for each build beat that creates or changes product behavior.

1. Read `SPEC.md`, `AGENTS.md`, and the current beat in `prompts/build-sequence.md`.
2. Write failing tests before implementation.
3. Implement only the smallest behavior slice required by the beat.
4. Run `npm run test -- --run`.
5. Complete the beat's manual verify gate before moving on.

Keep commands rooted in `part2-demo-app/` unless a beat explicitly enters `sandbox/`. Never commit secrets.
