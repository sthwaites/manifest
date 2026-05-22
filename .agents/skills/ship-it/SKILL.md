---
name: ship-it
description: Use at the end of the Manifest build to run release checks, catch secrets, prepare commits, and verify the submission-ready state.
---

# Ship It

Use this skill for Beat 10 and any final pre-submission pass.

## Checks

1. Run `npm run test -- --run`.
2. Run `npm run build`.
3. Run local smoke verification:
   - Main app on port 3000.
   - Sandbox app on port 3001.
   - Feature request streams App Server events.
   - Sandbox iframe reloads with the requested change.
4. Check for secrets before staging:
   - `git diff --staged | grep -E "(sk-|CLIENT_SECRET|NEXTAUTH_SECRET)"`
   - The command must return no matches.
5. Confirm required submission files exist:
   - `README.md`
   - `LICENSE`
   - `AGENTS.md`
   - `.agents/skills/scaffold-feature/SKILL.md`
   - `.agents/skills/add-tests/SKILL.md`
   - `.agents/skills/ship-it/SKILL.md`
   - `plugins/demo-plugin/.codex-plugin/plugin.json`

## Commit Guidance

- Commit after each logical unit if the build window allows it.
- Use `type(scope): short description`.
- Never commit `.env.local`, `data/dev.db`, generated database files, or local build outputs.
