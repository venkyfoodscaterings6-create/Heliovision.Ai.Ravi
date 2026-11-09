/**
 * HelioVision.Ai provider proxy.
 *
 * Purpose: forward a streaming provider request when the provider blocks direct
 * browser requests (CORS). This function intentionally stores and logs nothing:
 * no headers, no bodies, no API keys, no analytics.
 */
export const config = { runtime: "edge" };

const MAX_BODY_BYTES = 6 * 1024 * 1024;

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^\[?fc/i,
  /^\[?fd/i,
  /^\[?fe80:/i,
  /\.local$/i,
  /\.internal$/i,
];

const ALLOWED_METHODS = new Set(["GET", "POST"]);
const BROWSER_BLOCKED_HEADERS = new Set(["host", "content-length", "connection", "origin", "referer", "cookie", "accept-encoding"]);

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Same-origin requests may omit Origin. Vercel also sends the deployment host.
    return req.headers.get("sec-fetch-site") !== "cross-site";
  }
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

function validateTarget(raw: string): URL | null {
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return null;
  }
  if (target.protocol !== "https:") return null;
  if (target.username || target.password) return null;
  if (target.port && !["443", ""].includes(target.port)) return null;
  const host = target.hostname.replace(/^\[|\]$/g, "");
  if (!host || PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host))) return null;
  return target;
}

export default async function handler(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ error: "Origin not allowed." }, 403);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "same-origin",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "cache-control": "no-store",
      },
    });
  }

  if (!ALLOWED_METHODS.has(req.method)) return json({ error: "Method not allowed." }, 405);

  if (req.method === "GET") {
    return json({ status: "ok", note: "HelioVision proxy. POST { url, method, headers, body }." }, 200);
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "Request is too large." }, 413);

  let envelope: { url?: unknown; method?: unknown; headers?: unknown; body?: unknown };
  try {
    envelope = await req.json();
  } catch {
    return json({ error: "Expected a JSON request envelope." }, 400);
  }

  if (typeof envelope.url !== "string") return json({ error: "A target URL is required." }, 400);
  const target = validateTarget(envelope.url);
  if (!target) return json({ error: "Only https targets on public hosts are allowed." }, 400);

  const method = typeof envelope.method === "string" ? envelope.method.toUpperCase() : "POST";
  if (!ALLOWED_METHODS.has(method)) return json({ error: "Only GET and POST are allowed." }, 405);

  let outboundBody: string | undefined;
  if (method === "POST") {
    if (envelope.body !== undefined && typeof envelope.body !== "string") return json({ error: "Body must be a string." }, 400);
    outboundBody = envelope.body as string | undefined;
    if (outboundBody && outboundBody.length > MAX_BODY_BYTES) return json({ error: "Request is too large." }, 413);
  }

  const headers = new Headers();
  if (envelope.headers && typeof envelope.headers === "object" && !Array.isArray(envelope.headers)) {
    for (const [key, value] of Object.entries(envelope.headers as Record<string, unknown>)) {
      if (typeof value !== "string") continue;
      if (BROWSER_BLOCKED_HEADERS.has(key.toLowerCase())) continue;
      headers.set(key, value);
    }
  }
  headers.set("accept", headers.get("accept") ?? "text/event-stream");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const upstream = await fetch(target.toString(), {
      method,
      headers,
      body: method === "POST" ? outboundBody : undefined,
      redirect: "follow",
      signal: controller.signal,
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location || !validateTarget(new URL(location, target).toString())) {
        clearTimeout(timeout);
        return json({ error: "Blocked an unsafe redirect." }, 502);
      }
    }

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    responseHeaders.set("cache-control", "no-store, no-transform");
    responseHeaders.set("x-content-type-options", "nosniff");
    responseHeaders.set("x-accel-buffering", "no");

    clearTimeout(timeout);
    // Stream straight through. Nothing is buffered, stored or logged.
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    clearTimeout(timeout);
    const aborted = error instanceof Error && error.name === "AbortError";
    return json({ error: aborted ? "The provider took too long to respond." : "The provider could not be reached." }, aborted ? 504 : 502);
  }
}
