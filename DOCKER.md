# Docker 说明

本项目有两个 Dockerfile：

```text
Dockerfile        # 默认，Cloudflare remote 模式，不安装 Chromium
Dockerfile.local  # local 模式，安装 Chromium，保留原项目行为
```

## 默认模式：Cloudflare remote

默认 `docker-compose.yml` 使用：

```yaml
build: .
```

也就是使用 `Dockerfile`。

这个镜像只运行 Python 服务，不安装 Chromium，因为访问 Google 的浏览器在 Cloudflare Browser Rendering 里。

启动前需要 `.env`：

```bash
cp .env.cloudflare.example .env
```

填写：

```env
GEMINI_SEARCH_REMOTE_URL=https://gemini-search-worker.<account>.workers.dev
GEMINI_SEARCH_REMOTE_TOKEN=<same token as WORKER_TOKEN>
```

启动：

```bash
docker compose up -d --build
```

## local 模式：本机 Chrome/CDP

如果你想恢复原项目方式，让 Docker 自己安装并启动 Chromium，需要改 `docker-compose.yml`：

```yaml
services:
  gemini-search:
    build:
      context: .
      dockerfile: Dockerfile.local
    ports:
      - "8080:8080"
    restart: unless-stopped
    shm_size: "2gb"
    environment:
      - PYTHONUNBUFFERED=1
      - GEMINI_SEARCH_BACKEND=local
```

然后启动：

```bash
docker compose up -d --build
```

注意：

- local 模式需要 Docker 构建阶段能下载 Chromium。
- local 模式需要运行环境能访问 Google。
- 境内服务器通常不建议使用 local 模式。

## 查看日志

```bash
docker compose logs -f
```

Cloudflare remote 模式应该看到：

```text
Backend: cloudflare (...)
AI Mode engine ready
```

local 模式应该看到：

```text
Browser: subprocess/chrome (...)
AI Mode engine ready
```
