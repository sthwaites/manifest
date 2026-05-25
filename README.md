# Manifest

Manifest is a local, agent-assisted product catalogue workspace. The main app provides auth, prompts, event streaming, rollback/reset controls, debug history, and image generation. A separate sandbox catalogue runs in an iframe so Codex can rewrite catalogue source files while the user watches changes hot-reload.

## Tech Stack

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS
- NextAuth with Prisma adapter
- Prisma with SQLite for local persistence
- Vitest and Testing Library
- Codex App Server for agent-driven sandbox edits
- OpenAI APIs for transcription, moderation, and image generation

## Local Setup

Use Node 20.

```bash
npm ci
cd sandbox && npm ci
cd ..
npx prisma generate
npx prisma migrate dev
npm run sandbox:init
```

Create `.env.local` from `.env.example` and fill in the values that match your environment.

```bash
cp .env.example .env.local
```

For local development without OAuth, set `DEBUG_AUTH=true`.

## Environment Variables

| Variable              | Required   | Description                                                                         |
| --------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`      | Yes        | Used by OpenAI API routes.                                                          |
| `CODEX_API_KEY`       | Yes        | Used by the `codex app-server` process. Usually the same value as `OPENAI_API_KEY`. |
| `DATABASE_URL`        | Yes        | SQLite URL. Defaults to `file:../data/dev.db`.                                      |
| `NEXTAUTH_SECRET`     | Yes        | Secret for NextAuth session signing.                                                |
| `NEXTAUTH_URL`        | Yes        | Local URL, usually `http://localhost:3000`.                                         |
| `AUTH0_CLIENT_ID`     | OAuth only | Auth0 application client ID.                                                        |
| `AUTH0_CLIENT_SECRET` | OAuth only | Auth0 application client secret.                                                    |
| `AUTH0_ISSUER`        | OAuth only | Auth0 issuer URL.                                                                   |
| `DEBUG_AUTH`          | Local only | Set to `true` to bypass OAuth locally.                                              |
| `NEXT_PUBLIC_SANDBOX_PUBLIC_URL` | Deploy only | Browser URL for the iframe. Use `http://localhost:3001/` locally and `/sandbox/` on Fly. |
| `SANDBOX_INTERNAL_URL` | Deploy only | Server-side sandbox health URL. Use `http://localhost:3001` locally and `http://localhost:3001/sandbox` on Fly. |
| `SANDBOX_BASE_PATH`   | Deploy only | Public path used by the proxy for the sandbox, usually `/sandbox`.                  |
| `NEXT_PUBLIC_SANDBOX_BASE_PATH` | Deploy only | Same value as `SANDBOX_BASE_PATH`; lets the sandbox prefix images and Next assets. |

## Development

Run the main app and sandbox in separate terminals:

```bash
npm run dev
cd sandbox && npm run dev -- --port 3001
```

Open:

- Main app: `http://localhost:3000/catalogue`
- Baseline catalogue: `http://localhost:3000/baseline`
- Sandbox app: `http://localhost:3001`

Useful commands:

```bash
npm run verify
npm run lint
npm run typecheck
npm run test:run
npm run build
```

`npm run verify` runs the same local quality gates as CI: lint, typecheck, main app tests/build, and sandbox tests/build.

## Docker

The repository includes a production-like `docker-compose.yml` for running the main app, sandbox app, bridge, and SQLite data volume together. The main app runs from `next build`/`next start`; the sandbox runs inside Docker so Codex edits and the preview server share the same containerized workspace. Compose defaults to debug auth, so `/catalogue` opens without Auth0 setup.

```bash
docker compose up --build
```

Pass `OPENAI_API_KEY` and optionally `CODEX_API_KEY` from your shell or an uncommitted `.env.local` for agent and image features. `NEXTAUTH_SECRET` defaults to a local debug value in Compose; set it explicitly when testing real auth. To test real OAuth in Docker, rebuild with `DOCKER_DEBUG_AUTH=false` and provide the Auth0 variables.

Open:

- Main app: `http://localhost:3000/catalogue`
- Sandbox app: `http://localhost:3001`
- WebSocket bridge: `ws://localhost:3002/api/ws`

Useful Docker checks:

```bash
docker compose ps
docker compose logs app sandbox
```

CI publishes successful `main` builds to GHCR:

- `ghcr.io/sthwaites/manifest-app:latest`
- `ghcr.io/sthwaites/manifest-sandbox:latest`
- `ghcr.io/sthwaites/manifest-app:sha-<short-sha>`
- `ghcr.io/sthwaites/manifest-sandbox:sha-<short-sha>`

## Fly.io

Fly uses the root `Dockerfile` and `fly.toml` to run one public Machine. Inside that single container, the production Manifest app listens on port `3000`, the sandbox Next dev server listens on port `3001`, the Codex WebSocket bridge listens on port `3002` when opened by the app, and `scripts/proxy-server.mjs` exposes one public HTTP service on port `8080`.

Public routing:

- `/` and `/catalogue` proxy to the Manifest app.
- `/api/ws` proxies to the WebSocket bridge.
- `/sandbox/` proxies to the sandbox app, with the sandbox built under the `/sandbox` base path.

Before the first deploy, change the `app` and `NEXTAUTH_URL` values in `fly.toml` or pass your own app name through `fly launch --copy-config --name <your-fly-app-name>`.

Create one Fly volume for both SQLite data and the mutable sandbox working tree:

```bash
fly volumes create manifest_data --size 3 --region lhr
```

The volume mounts at `/app/persist`. The app stores SQLite data under `/app/persist/data`, and the startup script copies the bundled sandbox template into `/app/persist/sandbox` on first boot, then symlinks `/app/sandbox` there so Codex edits, generated images, and sandbox git history survive restarts and deploys.

Set runtime secrets:

```bash
fly secrets set \
  NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  OPENAI_API_KEY="sk-..." \
  CODEX_API_KEY="sk-..."
```

`CODEX_API_KEY` is used by the `codex app-server` process. If your Codex and OpenAI credentials are the same, set both to the same value. `DATABASE_URL` is intentionally in `fly.toml` as `file:/app/persist/data/prod.db`; update it only if you move the mounted volume.

Deploy:

```bash
fly deploy
```

Compose remains the recommended local production-like flow. It still runs the Manifest app and sandbox as separate local containers and keeps the browser iframe at `http://localhost:3001/`.

## CI and Codex Review

GitHub Actions runs linting, typechecking, runtime dependency audits, tests, production builds, and Docker image builds on pull requests and pushes to `main`. Pushes to `main` also publish app and sandbox container images to GitHub Container Registry.

The repository also includes an on-demand Codex PR review workflow. Comment `/codex-review` on a pull request, or run the `Codex PR Review` workflow manually, to ask Codex for a focused review of correctness, test coverage, Docker/runtime risk, security, and publication readiness. Configure either `CODEX_API_KEY` or `OPENAI_API_KEY` as a repository secret before using that workflow.

## Troubleshooting

- If `/catalogue` redirects to login during local development, set `DEBUG_AUTH=true`.
- If the laptop resumes with stale local processes, prefer the Docker path: `docker compose down` and then `docker compose up --build`.
- If the catalogue panel says "Sandbox unavailable", check `docker compose ps`, then restart the sandbox with `docker compose restart sandbox` and use `Check again`.
- If feature requests show app-server or bridge errors, confirm `OPENAI_API_KEY` or `CODEX_API_KEY` is set and inspect `docker compose logs app`.
- If reset fails, run `npm run sandbox:init` to recreate the sandbox git repository and `baseline` tag.
- If generated images do not appear, check `OPENAI_API_KEY`, moderation errors, and write access to `sandbox/public/images/`.

## License

Manifest is released under the MIT License. See [LICENSE](LICENSE).
