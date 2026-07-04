# Cloudflare + Docker 新手部署手册

本文档只针对当前文件夹：

```text
gemini-search-cloudflare-docker/
```

父目录中的原项目保持不变。Cloudflare 相关代码、配置和文档都放在当前新项目内。

如果你是第一次部署，建议按本文从上到下执行，不要跳步。这个项目分成两段：先让 Cloudflare Worker 能独立跑通，再让 Docker 去调用它。顺序反了，排错会非常难受。

## 目标架构

```text
MCP Client / OpenAI-compatible Client
  -> 境内 Docker 服务
     - MCP stdio server
     - OpenAI-compatible API
     - RemoteCloudflareEngine
  -> Cloudflare Worker
  -> Cloudflare Browser Rendering
  -> Google AI Mode
```

这个方案的核心是：境内 Docker 不直接访问 Google，也不启动用于 Google 请求的 Chrome。Docker 只调用 Cloudflare Worker，真正需要外网和浏览器环境的部分放到 Cloudflare 上执行。

## 文件说明

```text
gemini-search-cloudflare-docker/
  CLOUDFLARE_DEPLOYMENT.md
  DOCKER.md
  CONTRIBUTING.md
  SECURITY.md
  LICENSE
  docker-compose.yml
  gemini_search/
    backends.py
    engine.py
    server.py
  gemini_search_mcp/
    __init__.py
  cloudflare-worker/
    package.json
    wrangler.toml
    tsconfig.json
    README.md
    .dev.vars.example
    src/
      index.ts
```

关键文件：

- `gemini_search/backends.py`：新增 backend 选择器，支持 `local` 和 `cloudflare`。
- `cloudflare-worker/src/index.ts`：Cloudflare Worker 入口，负责调用 Browser Rendering。
- `cloudflare-worker/wrangler.toml`：Worker 部署配置。
- `docker-compose.yml`：Docker 服务配置，带 Cloudflare remote backend 示例变量。
- `DOCKER.md`：Docker remote/local 两种模式说明。
- `SECURITY.md`：开源部署时的安全注意事项。

## 模式说明

### local 模式

不设置 `GEMINI_SEARCH_BACKEND=cloudflare` 时，服务保持原项目行为：

```text
Docker 服务 -> 当前机器 Chrome/CDP -> Google
```

适合境外服务器、本地开发或可直接访问 Google 的环境。

### cloudflare 模式

设置 `GEMINI_SEARCH_BACKEND=cloudflare` 后：

```text
Docker 服务 -> Cloudflare Worker -> Browser Rendering -> Google
```

适合境内服务器部署。Docker 主机只需要能访问 Cloudflare。

## 前置条件

### 本地或部署机

需要：

- Docker
- Docker Compose
- Node.js 18+
- npm
- 一个 Cloudflare 账号
- 已开通 Workers
- 已开通 Browser Rendering / Browser Run 能力

### Cloudflare 权限

部署 Worker 的账号需要能：

- 创建/部署 Workers
- 使用 Browser Rendering binding
- 设置 Worker secret

## 第 1 步：配置 Cloudflare Worker

进入 Worker 目录：

```bash
cd gemini-search-cloudflare-docker/cloudflare-worker
```

安装依赖：

```bash
npm install
```

登录 Cloudflare：

```bash
npx wrangler login
```

检查 `wrangler.toml`：

```toml
name = "gemini-search-worker"
main = "src/index.ts"
compatibility_date = "2026-07-04"

browser = { binding = "BROWSER" }
```

如果你的 Cloudflare 账号要求不同的 Browser binding 配置，以 Cloudflare 控制台/官方文档为准，但 `binding` 名称必须和代码里的 `env.BROWSER` 对上。

## 第 2 步：设置 Worker 鉴权 Token

生成一个长随机 token。示例：

```bash
openssl rand -hex 32
```

如果没有 `openssl`，也可以用密码管理器生成一段高强度随机字符串。

设置到 Cloudflare Worker secret：

```bash
npx wrangler secret put WORKER_TOKEN
```

输入刚才生成的 token。

本地调试时，可以复制示例文件：

```bash
cp .dev.vars.example .dev.vars
```

然后把 `.dev.vars` 里的值改成真实 token。不要把真实 `.dev.vars` 提交到仓库。

## 第 3 步：部署 Worker

执行：

```bash
npx wrangler deploy
```

部署成功后，记录输出里的 Worker 地址，通常类似：

```text
https://gemini-search-worker.<your-account>.workers.dev
```

后面 Docker 要用这个地址作为：

```env
GEMINI_SEARCH_REMOTE_URL
```

## 第 4 步：测试 Worker 健康检查

健康检查不需要 token：

```bash
curl https://gemini-search-worker.<your-account>.workers.dev/health
```

期望返回：

```json
{"ok":true}
```

如果访问不到，先不要启动 Docker，先检查：

- Worker 是否部署成功
- 域名是否正确
- Cloudflare 账号是否启用了 Workers

## 第 5 步：测试 Worker 搜索接口

请求：

```bash
curl https://gemini-search-worker.<your-account>.workers.dev/ask \
  -H "Authorization: Bearer <WORKER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"what is 7*8? answer only the number\"}"
```

期望返回类似：

```json
{"answer":"56"}
```

如果返回：

```json
{"error":"unauthorized"}
```

说明 `Authorization` 里的 token 和 Cloudflare secret 不一致。

如果返回：

```json
{"error":"Google CAPTCHA during warmup"}
```

说明 Cloudflare 侧访问 Google 被验证码拦截。这个风险无法完全消除，需要后续做 session 复用、账号环境测试或更换执行策略。

## 第 6 步：配置 Docker 使用 Cloudflare backend

进入新项目根目录：

```bash
cd gemini-search-cloudflare-docker
```

复制环境变量示例：

```bash
cp .env.cloudflare.example .env
```

编辑 `.env`：

```env
GEMINI_SEARCH_REMOTE_URL=https://gemini-search-worker.<your-account>.workers.dev
GEMINI_SEARCH_REMOTE_TOKEN=<WORKER_TOKEN>
```

当前 `docker-compose.yml` 已经默认启用 Cloudflare backend：

```yaml
services:
  gemini-search:
    build: .
    ports:
      - "8080:8080"
    restart: unless-stopped
    shm_size: "2gb"
    environment:
      - PYTHONUNBUFFERED=1
      - GEMINI_SEARCH_BACKEND=cloudflare
      - GEMINI_SEARCH_REMOTE_URL=${GEMINI_SEARCH_REMOTE_URL}
      - GEMINI_SEARCH_REMOTE_TOKEN=${GEMINI_SEARCH_REMOTE_TOKEN}
```

启动：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f
```

看到类似下面的信息，说明 Docker 服务已经进入 Cloudflare remote backend：

```text
gemini-search-mcp v0.4.0
API: http://0.0.0.0:8080/v1
Backend: cloudflare (...)
AI Mode engine ready
```

## 第 7 步：测试 OpenAI-compatible API

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"gemini-search\",\"messages\":[{\"role\":\"user\",\"content\":\"what is 7*8? answer only the number\"}]}"
```

如果 Docker 部署在服务器上，把 `localhost` 换成你的服务器地址或反代域名。

## 第 8 步：MCP 使用方式

MCP stdio 仍然走原项目方式，只是内部 backend 变了。

启动前设置环境变量：

```env
GEMINI_SEARCH_BACKEND=cloudflare
GEMINI_SEARCH_REMOTE_URL=https://gemini-search-worker.<your-account>.workers.dev
GEMINI_SEARCH_REMOTE_TOKEN=<WORKER_TOKEN>
```

然后 MCP 工具调用：

```text
web_search("latest AI news")
ask("what is 1847 * 293")
```

会由本地/境内 MCP server 转发到 Cloudflare Worker 执行。

## 回退到原始 local 模式

如果 Cloudflare 侧不稳定，删掉或注释：

```env
GEMINI_SEARCH_BACKEND=cloudflare
GEMINI_SEARCH_REMOTE_URL=...
GEMINI_SEARCH_REMOTE_TOKEN=...
```

然后重启：

```bash
docker compose up -d --build
```

服务会回到原始模式：

```text
Docker -> Chrome/CDP -> Google
```

## 常见问题

### 1. Docker 仍然启动本地 Chrome

检查是否设置：

```env
GEMINI_SEARCH_BACKEND=cloudflare
```

值必须是 `cloudflare`、`remote` 或 `worker` 之一。

在本项目默认 `docker-compose.yml` 中已经设置为：

```yaml
- GEMINI_SEARCH_BACKEND=cloudflare
```

如果你改过 compose 文件，优先检查这里。

### 2. Worker 返回 `WORKER_TOKEN is not configured`

说明没有设置 Cloudflare secret：

```bash
npx wrangler secret put WORKER_TOKEN
```

设置后重新部署：

```bash
npx wrangler deploy
```

### 3. Worker 返回 `unauthorized`

说明 Docker 里的：

```env
GEMINI_SEARCH_REMOTE_TOKEN
```

和 Cloudflare Worker 的：

```text
WORKER_TOKEN
```

不一致。

### 4. Worker 返回 `no_token`

说明 Google 页面结构、AI Mode token 或返回内容和当前解析逻辑不一致。需要检查 `cloudflare-worker/src/index.ts` 中的 `ASK_JS`。

### 5. Worker 返回 CAPTCHA

说明 Cloudflare Browser Rendering 当前会话被 Google 挑战。可以尝试：

- 重试部署后再测
- 降低请求频率
- 做 Browser session reuse
- 在 Worker 中增加更完整的 warmup
- 如果长期出现，改用境外 VPS 搜索微服务会更稳

### 6. TypeScript 检查失败

先确认依赖安装：

```bash
cd cloudflare-worker
npm install
npm run typecheck
```

如果是 Cloudflare binding 类型报错，优先检查 `wrangler.toml` 中的：

```toml
browser = { binding = "BROWSER" }
```

以及 `src/index.ts` 里的：

```ts
env.BROWSER
```

两者必须一致。

## 安全建议

- 不要把 `WORKER_TOKEN` 写死到代码里。
- 不要把 `.dev.vars`、`.env` 上传到公开仓库。
- Worker 必须要求 Bearer token。
- 可以在 Cloudflare 上加 WAF、Rate Limiting 或 Access。
- Docker 服务如果暴露公网，也建议放在反向代理后面并加鉴权。

## 当前限制

- Cloudflare remote backend 第一版不是 token-by-token streaming，OpenAI streaming 接口会把完整 answer 当作一个 chunk 返回。
- Google AI Mode 页面结构变化会影响解析。
- Cloudflare Browser Rendering 有配额、并发和计费限制，正式使用前必须压测。
- 如果 Google 对 Cloudflare 执行环境触发 CAPTCHA，需要进一步优化 session 复用或切换外部执行层。
