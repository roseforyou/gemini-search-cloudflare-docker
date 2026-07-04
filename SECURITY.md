# Security Policy

## Secrets

Never commit these files or values:

- `.env`
- `.dev.vars`
- `WORKER_TOKEN`
- `GEMINI_SEARCH_REMOTE_TOKEN`
- Cloudflare API tokens
- Private origin URLs

The repository includes example files only:

- `.env.cloudflare.example`
- `cloudflare-worker/.dev.vars.example`

## Worker Exposure

The `/ask` endpoint must be protected by:

```http
Authorization: Bearer <WORKER_TOKEN>
```

For public deployments, consider adding:

- Cloudflare WAF rules
- Cloudflare Rate Limiting
- Cloudflare Access
- Request size limits
- Logging and alerting

## Responsible Use

This project does not provide CAPTCHA solving, credential theft, or bypass guarantees. It only separates the local API layer from the remote browser execution layer.

If you discover a security issue, please report it privately to the project maintainer instead of opening a public issue with exploitable details.
