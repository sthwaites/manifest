# Architecture

## CI / CD Pipeline

This diagram shows how a Jira ticket flows through to a deployed change — the canonical Codex + Jira integration pattern described in Part 1 of the assignment, made concrete in this repo.

```mermaid
graph TD
  A["Jira ticket\nlabel: codex-ready"] -->|Jira Automation webhook| B[GitHub Action]
  B -->|codex exec --non-interactive| C[Codex]
  C -->|commits fix to feature branch| D[Feature branch]
  D -->|PR opened| E[Pull Request]
  E -->|auto-fills pull_request_template.md| F[PR review]
  F -->|approved and merged| G[main branch]
  G -->|fly deploy| H[Fly.io]
  E -->|transitions ticket to In Review| A
```

The shared configuration lives entirely in the repo — the GitHub Action YAML, `AGENTS.md`, and the Skills under `.agents/skills/` — so every engineer on the team gets the same Codex behaviour without any per-machine setup.

The PR template (`.github/pull_request_template.md`) captures the Codex thread ID and original feature prompt so every machine-written PR is auditable: reviewers can trace exactly what was asked and replay the session in the Debug tab.

## App Architecture

```mermaid
graph LR
  subgraph Browser
    A[Catalogue iframe]
    B[Agent stream panel]
  end
  subgraph MainApp[Main App :3000]
    C[WebSocket bridge /api/ws]
    D[Auth / sessions]
    E[Image generation /api/images]
  end
  subgraph CodexAS[Codex App Server]
    F[codex app-server]
  end
  subgraph Sandbox[Sandbox :3001]
    G[Next.js dev server]
    H[Source files — sandbox git repo]
  end
  B -- WebSocket --> C
  C -- stdio JSON-RPC --> F
  F -- writes files --> H
  H -- hot-reload --> G
  G -- iframe --> A
  E --> I[OpenAI gpt-image-2]
  D --> J[(Prisma / SQLite)]
```

The App Server's `workspaceWrite` sandbox is scoped to `./sandbox/` only — it cannot write outside that directory. The sandbox is its own git repository: every completed Codex turn produces one commit, giving a full rollback history. The `baseline` tag marks the initial state; "Reset to baseline" (`POST /api/reset`) resets to that tag regardless of how many commits have accumulated.
