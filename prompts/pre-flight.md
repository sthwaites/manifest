# Pre-flight Checklist — Before the 4-Hour Codex Window

Complete everything here before starting the build clock.
Estimated time: 45–60 minutes.

---

## 1. OpenAI API key

One key covers everything in this app:

| Use | Surface |
|-----|---------|
| Image generation | `gpt-image-2` (Images API) |
| Push-to-record | `whisper-1` (Audio API) |
| Content moderation | `text-moderation-latest` (free) |
| Codex App Server — local | ChatGPT Pro browser auth |
| Codex App Server — Fly.io | `CODEX_API_KEY` = same API key (headless) |

- [ ] Confirm API key has access to the Images API (`gpt-image-2` requires a paid account)
- [ ] Note it down — needed in step 4 and step 6

**Record:** `OPENAI_API_KEY` = `sk-...`

---

## 2. Auth0 — Google OAuth

- [ ] https://auth0.com → sign up (free tier, 7,500 MAU)
- [ ] Create application: **Regular Web Application**, name it "Manifest"
- [ ] **Allowed Callback URLs:**
      `http://localhost:3000/api/auth/callback/auth0`
      *(add Fly.io URL after deploy: `https://<app>.fly.dev/api/auth/callback/auth0`)*
- [ ] **Allowed Logout URLs:** `http://localhost:3000`
- [ ] **Connections → Google / Gmail:** enable (Auth0's default dev key is fine)
- [ ] Note down from the Settings tab:

**Record:**
- `AUTH0_CLIENT_ID` =
- `AUTH0_CLIENT_SECRET` =
- `AUTH0_ISSUER` = `https://<domain>.auth0.com` *(the Domain field, prefixed with https://)*

---

## 3. Generate NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

**Record:** `NEXTAUTH_SECRET` =

---

## 4. Create `.env.local`

In the `part2-demo-app/` directory — this file is gitignored and must never be committed:

```bash
OPENAI_API_KEY=sk-...
NEXTAUTH_SECRET=<step 3>
AUTH0_CLIENT_ID=<step 2>
AUTH0_CLIENT_SECRET=<step 2>
AUTH0_ISSUER=https://<domain>.auth0.com
DEBUG_AUTH=false
DATABASE_URL=file:./data/dev.db
NEXTAUTH_URL=http://localhost:3000
```

- [ ] File created with all values filled in
- [ ] Verified `.gitignore` lists `.env.local` before any `git add`

---

## 5. Fly.io account + CLI

*(Can be done after the Loom recording if you prefer — only needed for the live URL.)*

- [ ] Create account: https://fly.io
- [ ] Install CLI: `brew install flyctl`
- [ ] Log in: `flyctl auth login`
- [ ] Verify: `flyctl version`

`fly launch` runs during Beat 9 (or post-Loom) — not needed yet.

---

## 6. Base product images

The `/baseline` page and before/after ImageModal require white-background studio shots committed to the repo before the build starts.

- [ ] Set API key in shell: `export OPENAI_API_KEY=sk-...`
- [ ] Install Python client: `pip3 install openai`
- [ ] Run script: `python3 seed/generate-base-images.py`
      Expected: `sandbox/public/images/prod_00{1-6}-base.png`
- [ ] Verify: `ls -lh sandbox/public/images/*-base.png` (6 files, non-empty)
- [ ] Commit:
      ```bash
      git add sandbox/public/images/*-base.png
      git commit -m "chore: add base product images"
      ```

---

## 7. Local toolchain

- [ ] Node.js 20+: `node --version`
- [ ] npm 10+: `npm --version`
- [ ] From `part2-demo-app/`, run `nvm use` if your shell has not already selected Node 20
- [ ] Codex CLI installed: `npm i -g @openai/codex` → `codex --version`
- [ ] Signed in to Codex (ChatGPT Pro): `codex` → browser auth if prompted
- [ ] Browser MCP servers visible in Codex `/mcp`: `chrome_devtools` and `playwright`
- [ ] Docker Desktop running: `docker info` (no error)
- [ ] GitHub CLI installed and authenticated: `gh --version` → `gh auth login`
- [ ] Fly.io CLI installed and authenticated: `flyctl version` → `flyctl auth login`
- [ ] Python 3: `python3 --version`

---

## 8. Microphone + recording setup

- [ ] Microphone working — push-to-record (Whisper) requires it
      Test: open Voice Memos, speak, play back
- [ ] Loom installed and logged in: https://www.loom.com/download
- [ ] Screen layout prepared for recording:
      - Left ~60%: `/baseline` page or catalogue iframe
      - Right ~40%: Agent event stream panel
- [ ] Notifications silenced (macOS: Do Not Disturb / Windows: Focus Assist)

---

## 9. Things to have open when the Codex window starts

- [ ] This file (`pre-flight.md`)
- [ ] `SPEC.md` — skim before starting
- [ ] `AGENTS.md` — check it looks right
- [ ] `prompts/build-sequence.md` — beat-by-beat prompt sequence
- [ ] Terminal Tab 1: ready for `npm run dev`
- [ ] Terminal Tab 2: ready for `cd sandbox && npm run dev -- --port 3001`
- [ ] Auth0 dashboard open (callback URLs need updating after `fly launch`)
- [ ] `.env.local` created and verified

---

## Secrets reference — fill in before starting

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | `sk-...` |
| `NEXTAUTH_SECRET` | |
| `AUTH0_CLIENT_ID` | |
| `AUTH0_CLIENT_SECRET` | |
| `AUTH0_ISSUER` | `https://...auth0.com` |
| `NEXTAUTH_URL` (local) | `http://localhost:3000` |
| `NEXTAUTH_URL` (Fly.io) | `https://...fly.dev` *(fill after deploy)* |
| Fly.io app name | *(fill after `fly launch`)* |

---

## Fly.io secrets — run after `fly launch` (Beat 9 or post-Loom)

```bash
fly secrets set OPENAI_API_KEY="sk-..."
fly secrets set CODEX_API_KEY="sk-..."        # same key — headless App Server auth
fly secrets set NEXTAUTH_SECRET="..."
fly secrets set AUTH0_CLIENT_ID="..."
fly secrets set AUTH0_CLIENT_SECRET="..."
fly secrets set AUTH0_ISSUER="https://...auth0.com"
fly secrets set NEXTAUTH_URL="https://<app>.fly.dev"
```

**Never set `DEBUG_AUTH` on Fly.io.** Leave it unset.

Update Auth0 callback URLs to add: `https://<app>.fly.dev/api/auth/callback/auth0`

Pre-push secrets check:
```bash
git diff --staged | grep -E "(sk-|CLIENT_SECRET|NEXTAUTH_SECRET)"
# must return nothing
```

---

## What works where

| Feature | Local | Fly.io |
|---------|-------|--------|
| `/baseline` page | ✅ | ✅ |
| Sign in with Google | ✅ | ✅ |
| Feature requests → Codex App Server | ✅ | ✅ via `CODEX_API_KEY` |
| App Server event stream | ✅ | ✅ |
| Image generation (gpt-image-2) | ✅ | ✅ |
| Push-to-record (Whisper) | ✅ | ✅ |
| Sandbox iframe — live HMR | ✅ | ❌ |
| Sandbox iframe — reload on turn complete | ✅ | ✅ |

The Loom is recorded locally — evaluators see full HMR.
Fly.io shows the complete feature set with full-page iframe reload after each turn.
