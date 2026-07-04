# Contributing

Thanks for considering a contribution.

This project is intentionally small: a Python Docker service plus a Cloudflare Worker execution backend. Contributions are most useful when they improve reliability, deployment clarity, or operational safety.

## Good First Contributions

- Improve deployment docs for a specific platform.
- Add clearer error messages for Worker failures.
- Add smoke tests for `/health` and `/ask`.
- Improve Docker examples.
- Add Browser Rendering session reuse.

## Development Setup

Python service:

```bash
pip install -e .
python -m py_compile gemini_search/backends.py gemini_search/server.py gemini_search_mcp/__init__.py
```

Cloudflare Worker:

```bash
cd cloudflare-worker
npm install
npm run typecheck
```

## Pull Request Checklist

Before opening a PR, please check:

- Python files pass syntax/type sanity checks.
- Worker TypeScript passes `npm run typecheck`.
- Docs are updated when behavior or environment variables change.
- Secrets are not committed.
- Changes keep both modes in mind: `cloudflare` and `local`.

## Style

- Keep the Python service conservative and easy to run in Docker.
- Keep Worker code explicit; avoid clever abstractions around Browser Rendering.
- Prefer clear operational errors over silent fallbacks.
- Document limitations honestly.

## Security

Do not open public issues containing tokens, Cloudflare account IDs, private Worker URLs, or deployment credentials. See [SECURITY.md](./SECURITY.md).
