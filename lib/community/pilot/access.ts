import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const HOST_COOKIE = "sundays_pilot_host";
export const MEMBER_COOKIE = "sundays_pilot_member";
export const HOST_TTL_MS = 2 * 60 * 60_000;

export function pilotEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.COMMUNITY_PILOT_ENABLED === "true" && !env.VERCEL && (env.COMMUNITY_PILOT_HOST_KEY?.length ?? 0) >= 32;
}

export function isLoopback(url: URL): boolean {
  return ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

export function loopbackHostOrigin(host: string, protocol = "http:"): string | null {
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)) return null;
  try {
    const url = new URL(protocol + "//" + host);
    return isLoopback(url) ? url.origin : null;
  } catch { return null; }
}

export function pilotOrigin(request: Request): string | null {
  const url = new URL(request.url);
  if (!isLoopback(url)) return null;
  const host = request.headers.get("host");
  return host === null ? url.origin : loopbackHostOrigin(host, url.protocol);
}

export function memberContext(session: string): string {
  return createHash("sha256").update("sundays-pilot-context\0" + session).digest("hex").slice(0, 24);
}

export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

function sign(secret: string, expiry: string): string {
  return createHmac("sha256", secret).update("sundays-pilot-host\0" + expiry).digest("base64url");
}

export function newHostSession(secret: string, now: number): string {
  const expiry = String(now + HOST_TTL_MS);
  return expiry + "." + sign(secret, expiry);
}

export function validHostSession(value: string, secret: string, now: number): boolean {
  if (!/^\d{10,16}\.[a-zA-Z0-9_-]{43}$/.test(value)) return false;
  const [expiry, signature] = value.split(".");
  return Number(expiry) > now && safeEqual(signature, sign(secret, expiry));
}

export function cookieValue(request: Request, name: string): string {
  const entries = (request.headers.get("cookie") ?? "").split(";").map(cookie => cookie.trim());
  const values = entries.filter(entry => entry.startsWith(name + "="));
  if (values.length !== 1) return "";
  const value = values[0].slice(name.length + 1);
  return /^[a-zA-Z0-9_.-]{1,128}$/.test(value) ? value : "";
}

export function setCookie(response: Response, request: Request, name: string, value: string, ttlMs: number): Response {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  response.headers.append("Set-Cookie", name + "=" + value +
    "; HttpOnly; SameSite=Strict; Path=/api/community/pilot; Max-Age=" + Math.floor(ttlMs / 1000) + secure);
  return response;
}
