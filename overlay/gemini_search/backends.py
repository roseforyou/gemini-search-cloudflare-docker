"""Engine selection for local Chrome and remote Cloudflare backends."""
from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request
from typing import Optional

from .engine import AIModeEngine


class RemoteCloudflareEngine:
    """Remote engine that delegates Google AI Mode execution to a Worker."""

    def __init__(self, remote_url: Optional[str] = None, token: Optional[str] = None):
        self.remote_url = (remote_url or os.environ.get("GEMINI_SEARCH_REMOTE_URL") or "").rstrip("/")
        self.token = token or os.environ.get("GEMINI_SEARCH_REMOTE_TOKEN")

    async def start(self, **_kwargs):
        if not self.remote_url:
            raise RuntimeError("GEMINI_SEARCH_REMOTE_URL is required for cloudflare backend")
        if not self.token:
            raise RuntimeError("GEMINI_SEARCH_REMOTE_TOKEN is required for cloudflare backend")

    async def ask(self, question: str, timeout_ms: int = 45000) -> str:
        return await asyncio.to_thread(self._post_ask, question, timeout_ms)

    async def ask_stream(self, question: str, timeout_ms: int = 45000):
        text = await self.ask(question, timeout_ms)
        if text:
            yield text

    async def stop(self):
        return None

    def _post_ask(self, question: str, timeout_ms: int) -> str:
        payload = json.dumps({"query": question}, ensure_ascii=False).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

        request = urllib.request.Request(
            f"{self.remote_url}/ask",
            data=payload,
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=max(1, timeout_ms / 1000)) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Cloudflare backend HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Cannot reach Cloudflare backend: {exc}") from exc

        try:
            data = json.loads(body)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Cloudflare backend returned non-JSON response: {body[:200]}") from exc

        if data.get("error"):
            raise RuntimeError(str(data["error"]))
        return str(data.get("answer", ""))


def create_engine():
    """Create the configured engine backend.

    GEMINI_SEARCH_BACKEND:
      - local, chrome, or empty: launch/control Chrome from this process.
      - cloudflare or remote: call a remote Cloudflare Worker.
    """
    backend = (os.environ.get("GEMINI_SEARCH_BACKEND") or "local").strip().lower()
    if backend in {"local", "chrome", "subprocess", "undetected"}:
        return AIModeEngine()
    if backend in {"cloudflare", "remote", "worker"}:
        return RemoteCloudflareEngine()
    raise ValueError("GEMINI_SEARCH_BACKEND must be 'local' or 'cloudflare'")
