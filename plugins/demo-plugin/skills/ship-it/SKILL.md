---
name: ship-it
description: Use at the end of the Manifest build to run release checks, catch secrets, prepare commits, and verify the submission-ready state.
---

# Ship It

Run final release checks:

1. `npm run test -- --run`
2. `npm run build`
3. Local smoke test on ports 3000 and 3001.
4. Staged secret scan with `git diff --staged | grep -E "(sk-|CLIENT_SECRET|NEXTAUTH_SECRET)"`.
5. Confirm README, LICENSE, AGENTS.md, Skills, and plugin manifest are present.

Do not commit `.env.local`, database files, build outputs, or secrets.
