# Apply This Overlay To The Original Project

This repository intentionally does not vendor the original project source.

Use it as an overlay:

```bash
git clone <original-gemini-search-mcp-repo> gemini-search-mcp
cd gemini-search-mcp
```

Copy the new backend file:

```bash
cp ../gemini-search-cloudflare-docker/overlay/gemini_search/backends.py gemini_search/backends.py
```

Apply the patch:

```bash
git apply ../gemini-search-cloudflare-docker/patches/cloudflare-backend.patch
```

Copy the Cloudflare Docker files:

```bash
cp ../gemini-search-cloudflare-docker/overlay/Dockerfile.cloudflare ./Dockerfile.cloudflare
cp ../gemini-search-cloudflare-docker/overlay/docker-compose.cloudflare.yml ./docker-compose.cloudflare.yml
cp ../gemini-search-cloudflare-docker/.env.cloudflare.example ./.env.cloudflare.example
```

Then follow:

```text
CLOUDFLARE_DEPLOYMENT.md
```
