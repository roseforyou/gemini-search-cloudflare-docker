# Cloudflare Worker

This directory contains the remote browser execution layer for `gemini-search-cloudflare-docker`.

The parent project runs the Docker/MCP/OpenAI-compatible service. This Worker receives `/ask` requests, launches Cloudflare Browser Rendering, runs the Google AI Mode extraction logic inside a browser page, and returns a JSON answer.

## Quick Deploy

```bash
npm install
npx wrangler login
npx wrangler secret put WORKER_TOKEN
npx wrangler deploy
```

## Local Development

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

`.dev.vars` must contain:

```env
WORKER_TOKEN=replace-with-a-long-random-token
```

## Endpoints

### `GET /health`

No authentication required.

```bash
curl http://localhost:8787/health
```

Expected response:

```json
{"ok":true}
```

### `POST /ask`

Requires Bearer token authentication.

```bash
curl http://localhost:8787/ask \
  -H "Authorization: Bearer <WORKER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"what is 7*8? answer only the number\"}"
```

Expected response:

```json
{"answer":"56"}
```

## Notes

- This is not a plain HTTP proxy.
- Google requests run inside a Cloudflare Browser Rendering page.
- The extraction logic in `src/index.ts` is adapted from the original local Chrome/CDP flow.
- Read the parent [deployment guide](../CLOUDFLARE_DEPLOYMENT.md) before production deployment.
