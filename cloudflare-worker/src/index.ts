import puppeteer from "@cloudflare/puppeteer";

interface Env {
  BROWSER: any;
  WORKER_TOKEN?: string;
}

interface AskRequest {
  query?: string;
}

const ASK_JS = String.raw`
async (q) => {
  try {
    const pageUrl = 'https://www.google.com.hk/search?q=' + encodeURIComponent(q) + '&hl=en&gl=us&udm=50&aep=1&ntc=1';
    const r1 = await fetch(pageUrl, { credentials: 'include' });
    if (!r1.ok) return { error: 'fetch_status_' + r1.status, htmlLen: 0 };
    const html = await r1.text();
    const m = (p) => {
      const x = html.match(p);
      return x ? x[1] : '';
    };
    const srtst = m(/data-srtst="([^"]+)"/);
    if (!srtst) return { error: 'no_token', htmlLen: html.length, preview: html.substring(0, 200) };
    const xsrf = m(/data-xsrf-folwr-token="([^"]+)"/);
    const garc = m(/data-garc="([^"]+)"/);
    const lro = m(/data-lro-token="([^"]+)"/);
    const mlros = m(/data-lro-signature="([^"]+)"/);
    const ei = m(/data-ei="([^"]+)"/);
    const stkp = m(/data-stkp="([^"]+)"/);
    const ved = m(/aria-current="page"[^>]*data-ved="([^"]+)"/);
    const sca = m(/sca_esv=([a-f0-9]+)/);
    const p = new URLSearchParams({
      srtst,
      garc,
      mlro: lro,
      mlros,
      ei,
      q,
      yv: '3',
      vet: '1' + ved + '..i',
      ved,
      aep: '1',
      gl: 'us',
      hl: 'en',
      sca_esv: sca,
      udm: '50',
      stkp,
      cs: '0',
      async: '_fmt:adl,_xsrf:' + xsrf
    });
    const r2 = await fetch('https://www.google.com.hk/async/folwr?' + p.toString(), { credentials: 'include' });
    if (!r2.ok) return { error: 'folwr_status_' + r2.status };
    const fh = await r2.text();
    const div = document.createElement('div');
    div.innerHTML = fh;
    div.querySelectorAll('script,style,button,noscript,[aria-hidden="true"],span[style*="display:none"],.LGKDTe,.SGF5Lb').forEach((x) => x.remove());
    const parts = [];
    div.querySelectorAll('.pTRUV').forEach((el) => {
      const t = el.textContent.trim();
      if (t && t.length > 1) parts.push(t);
    });
    div.querySelectorAll('.n6owBd').forEach((el) => {
      const t = el.textContent.trim();
      if (t && t.length > 10) parts.push(t);
    });
    if (!parts.length) {
      div.querySelectorAll('.mZJni,.XEqVsf,.ub891').forEach((x) => x.remove());
      div.querySelectorAll('[dir="ltr"]').forEach((el) => {
        const t = el.textContent.trim();
        if (t.length > 30) parts.push(t);
      });
    }
    let text = parts.join('\n\n');
    const noise = ['Copy', 'Share', 'Good response', 'Bad response', 'About this result', 'Show all', 'AI responses may include mistakes', 'Tell me which'];
    for (const n of noise) {
      while (text.endsWith(n)) text = text.slice(0, -n.length).trim();
    }
    return { ok: true, answer: text, folwrLen: fh.length };
  } catch (e) {
    return { error: 'js_exception', message: e instanceof Error ? e.message : String(e) };
  }
}
`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }

    if (request.method !== "POST" || url.pathname !== "/ask") {
      return json({ error: "not_found" }, 404);
    }

    const authError = validateAuth(request, env);
    if (authError) return authError;

    let body: AskRequest;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const query = body.query?.trim();
    if (!query) {
      return json({ error: "query is required" }, 400);
    }

    try {
      const answer = await askGoogleAiMode(env, query);
      return json({ answer });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 502);
    }
  }
};

function validateAuth(request: Request, env: Env): Response | null {
  if (!env.WORKER_TOKEN) {
    return json({ error: "WORKER_TOKEN is not configured" }, 500);
  }
  const expected = `Bearer ${env.WORKER_TOKEN}`;
  if (request.headers.get("Authorization") !== expected) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

async function askGoogleAiMode(env: Env, query: string): Promise<string> {
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.goto("https://www.google.com.hk/search?q=hello&hl=en&gl=us", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    const currentUrl = page.url();
    if (currentUrl.includes("/sorry/")) {
      throw new Error("Google CAPTCHA during warmup");
    }

    const result = await page.evaluate(
      (source, q) => {
        const run = Function(`return (${source})`)();
        return run(q);
      },
      ASK_JS,
      query
    );
    if (!result || typeof result !== "object") {
      return result ? String(result) : "";
    }

    const data = result as { ok?: boolean; answer?: string; error?: string; message?: string };
    if (data.error) {
      throw new Error(`${data.error}: ${data.message || ""}`.trim());
    }
    return data.answer || "";
  } finally {
    await browser.close();
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
