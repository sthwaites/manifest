# Security

## Secrets

Do not commit `.env`, `.env.local`, API keys, OAuth client secrets, local databases, generated images, or runtime sandbox state. The repository ignores those files by default.

Configure GitHub Actions secrets only in repository settings. The Codex review workflow uses `CODEX_API_KEY` when present and falls back to `OPENAI_API_KEY`.

## Reporting

This repository is private during initial publication. Report security issues directly to the repository owner instead of filing a public issue.

## Runtime Notes

- Docker Compose defaults to debug auth for local evaluation only.
- Set `DOCKER_DEBUG_AUTH=false` and provide Auth0 variables before testing production auth.
- The Codex App Server receives write access only to the sandbox workspace.
