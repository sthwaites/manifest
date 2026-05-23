# Manifest

Manifest is a local, agent-assisted product catalogue workspace. The main app provides auth, prompts, event streaming, rollback/reset controls, debug history, and image generation. A separate sandbox catalogue runs in an iframe so Codex can rewrite catalogue source files while the user watches changes hot-reload.

## Screenshots

Add current screenshots before publishing:

- `docs/screenshots/catalogue-workspace.png`
- `docs/screenshots/agent-stream.png`
- `docs/screenshots/image-generation.png`

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

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Used by OpenAI API routes. |
| `CODEX_API_KEY` | Yes | Used by the `codex app-server` process. Usually the same value as `OPENAI_API_KEY`. |
| `DATABASE_URL` | Yes | SQLite URL. Defaults to `file:../data/dev.db`. |
| `NEXTAUTH_SECRET` | Yes | Secret for NextAuth session signing. |
| `NEXTAUTH_URL` | Yes | Local URL, usually `http://localhost:3000`. |
| `AUTH0_CLIENT_ID` | OAuth only | Auth0 application client ID. |
| `AUTH0_CLIENT_SECRET` | OAuth only | Auth0 application client secret. |
| `AUTH0_ISSUER` | OAuth only | Auth0 issuer URL. |
| `DEBUG_AUTH` | Local only | Set to `true` to bypass OAuth locally. |

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
npm run test -- --run
npm run build
cd sandbox && npm run test -- --run
cd sandbox && npm run build
```

## Docker

The repository includes a `docker-compose.yml` for running the main app, sandbox app, and SQLite data volume together.

```bash
docker compose up --build
```

Pass `OPENAI_API_KEY` and `NEXTAUTH_SECRET` from your shell or an uncommitted `.env.local`.

## Troubleshooting

- If `/catalogue` redirects to login during local development, set `DEBUG_AUTH=true`.
- If feature requests show "App Server not running", confirm the `codex` CLI is installed and `CODEX_API_KEY` is set.
- If reset fails, run `npm run sandbox:init` to recreate the sandbox git repository and `baseline` tag.
- If generated images do not appear, check `OPENAI_API_KEY`, moderation errors, and write access to `sandbox/public/images/`.

## License

Manifest is released under the MIT License. See [LICENSE](LICENSE).
