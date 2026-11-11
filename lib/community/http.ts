export class CommunityError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function demoEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" || env.COMMUNITY_DEMO_ENABLED === "true";
}

export async function boundedJson(source: Request | Response, maxBytes: number): Promise<unknown> {
  const length = Number(source.headers.get("Content-Length") || 0);
  if (length > maxBytes) throw new CommunityError("That response is too large. Try a smaller source.", 413);
  if (!source.body) throw new CommunityError("A JSON request is required.");
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) { await reader.cancel(); throw new CommunityError("That response is too large. Try a smaller source.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new CommunityError("That request could not be read. Please try again."); }
}

export async function requestJson(request: Request, expectedOrigin = new URL(request.url).origin): Promise<unknown> {
  const origin = request.headers.get("Origin");
  if (origin && origin !== expectedOrigin) throw new CommunityError("Open this preview on its own site to continue.", 403);
  if (!request.headers.get("Content-Type")?.includes("application/json")) throw new CommunityError("Use a JSON request.", 415);
  return boundedJson(request, 16_384);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export function errorResponse(error: unknown): Response {
  return error instanceof CommunityError
    ? jsonResponse({ error: error.message }, error.status)
    : jsonResponse({ error: "Something interrupted this preview. Please try again." }, 500);
}
