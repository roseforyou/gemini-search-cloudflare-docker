# gemini-search-cloudflare-docker

<p align="center">
  <img src="banner.png" width="720" alt="gemini-search-cloudflare-docker">
</p>

<p align="center">
  <strong>Run the MCP/OpenAI-compatible gateway in Docker, and execute Google AI Mode search through Cloudflare Browser Rendering.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a>
  ·
  <a href="./CLOUDFLARE_DEPLOYMENT.md">Deployment Guide</a>
  ·
  <a href="./DOCKER.md">Docker Guide</a>
  ·
  <a href="./cloudflare-worker">Worker</a>
</p>

## What Is This

`gemini-search-cloudflare-docker` is a Cloudflare-ready variant of `gemini-search-mcp`.

The original project runs a local Chrome/Chromium browser, controls it through CDP, and asks Google AI Mode from inside a real browser context. That design works well on machines that can reach Google directly, but it is awkward when the main Docker service must run in a network where Google is unreliable or unavailable.

This fork keeps the useful local service layer:

- MCP tools: `web_search(query)` and `ask(prompt)`
- OpenAI-compatible endpoint: `/v1/chat/completions`
- Docker Compose deployment

And moves the external browser execution layer to Cloudflare:

```text
Client
  -> Docker service
  -> RemoteCloudflareEngine
  -> Cloudflare Worker
  -> Cloudflare Browser Rendering
  -> Google AI Mode
```

## Why This Exists

The useful split is simple:

- Put your application-facing API on your own Docker host.
- Put the Google-facing browser execution on Cloudflare.
- Keep a local Chrome/CDP fallback for servers that can reach Google directly.

This is not a plain HTTP proxy. The Cloudflare Worker uses Browser Rendering so the Google request still happens inside a browser page, which is much closer to the original CDP approach than a raw `fetch()` proxy.

## Features

- Dockerized MCP server and OpenAI-compatible API.
- Cloudflare Worker backend using Browser Rendering.
- Local Chrome/CDP mode preserved as a fallback.
- Token-protected Worker endpoint.
- Beginner-friendly deployment docs.
- Separate Dockerfiles for remote and local modes.

## Project Layout

```text
gemini-search-cloudflare-docker/
  README.md
  CLOUDFLARE_DEPLOYMENT.md
  DOCKER.md
  Dockerfile
  Dockerfile.local
  docker-compose.yml
  .env.cloudflare.example
  gemini_search/
    backends.py
    engine.py
    server.py
  gemini_search_mcp/
    __init__.py
  cloudflare-worker/
    README.md
    .dev.vars.example
    package.json
    wrangler.toml
    src/index.ts
```

## Quick Start

### 1. Deploy the Cloudflare Worker

```bash
cd cloudflare-worker
npm install
npx wrangler login
npx wrangler secret put WORKER_TOKEN
npx wrangler deploy
```

Save the Worker URL from Wrangler output. It usually looks like:

```text
https://gemini-search-worker.<account>.workers.dev
```

### 2. Test the Worker

```bash
curl https://gemini-search-worker.<account>.workers.dev/health
```

Expected response:

```json
{"ok":true}
```

Then test the search endpoint:

```bash
curl https://gemini-search-worker.<account>.workers.dev/ask \
  -H "Authorization: Bearer <WORKER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"what is 7*8? answer only the number\"}"
```

Expected response:

```json
{"answer":"56"}
```

### 3. Configure Docker

Return to the project root:

```bash
cd ..
cp .env.cloudflare.example .env
```

Edit `.env`:

```env
GEMINI_SEARCH_REMOTE_URL=https://gemini-search-worker.<account>.workers.dev
GEMINI_SEARCH_REMOTE_TOKEN=<same token as WORKER_TOKEN>
```

### 4. Start the Docker Service

```bash
docker compose up -d --build
docker compose logs -f
```

You should see:

```text
Backend: cloudflare (...)
AI Mode engine ready
```

### 5. Call the OpenAI-Compatible API

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"gemini-search\",\"messages\":[{\"role\":\"user\",\"content\":\"what is 7*8? answer only the number\"}]}"
```

## Runtime Modes

### Cloudflare Remote Mode

Default mode in this project.

```text
Docker -> Cloudflare Worker -> Browser Rendering -> Google
```

Use this when your Docker host should not, or cannot, access Google directly.

### Local Chrome Mode

Fallback mode inherited from the original project.

```text
Docker -> local Chrome/Chromium -> Google
```

Use this on a VPS or local machine that can access Google directly. See [DOCKER.md](./DOCKER.md) for the `Dockerfile.local` setup.

## Environment Variables

Docker service:

| Variable | Required | Description |
|---|---:|---|
| `GEMINI_SEARCH_BACKEND` | Yes | `cloudflare` for remote mode. Already set in `docker-compose.yml`. |
| `GEMINI_SEARCH_REMOTE_URL` | Yes | Cloudflare Worker URL. |
| `GEMINI_SEARCH_REMOTE_TOKEN` | Yes | Must match Worker `WORKER_TOKEN`. |

Cloudflare Worker:

| Variable | Required | Description |
|---|---:|---|
| `WORKER_TOKEN` | Yes | Bearer token for `/ask`, set with `wrangler secret put WORKER_TOKEN`. |

## Documentation

- [Cloudflare + Docker Deployment Guide](./CLOUDFLARE_DEPLOYMENT.md)
- [Docker Guide](./DOCKER.md)
- [Cloudflare Worker Guide](./cloudflare-worker/README.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)

## Current Limitations

- Cloudflare Browser Rendering has usage limits, concurrency limits, and cost considerations.
- Google may still return CAPTCHA or change AI Mode page structure.
- Remote streaming is not token-by-token yet. The current OpenAI streaming path emits the full answer as one chunk.
- This project does not provide Google credentials, bypass guarantees, or CAPTCHA solving.

## Roadmap

- Browser session reuse on Cloudflare.
- Better error diagnostics for `no_token`, CAPTCHA, and empty answers.
- Optional request rate limiting at the Worker layer.
- True streaming transport for remote backend.
- Automated smoke tests for the Worker endpoint.

## Acknowledgements

This project is based on the `gemini-search-mcp` architecture and keeps its MCP/OpenAI-compatible service surface while adding a Cloudflare remote execution backend.

## License

MIT. See [LICENSE](./LICENSE).
