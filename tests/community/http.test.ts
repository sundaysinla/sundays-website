import test from "node:test";
import assert from "node:assert/strict";
import { handleDiscovery, handleImport } from "../../lib/community/handlers.ts";

const request = (body: unknown, headers: Record<string, string> = {}) => new Request("http://localhost:4000/api/community/discover", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const dev = { NODE_ENV: "development" };

test("production demo is closed by default", async () => {
  assert.equal((await handleDiscovery(request({}), { NODE_ENV: "production" })).status, 404);
  assert.equal((await handleImport(request({}), { NODE_ENV: "production" })).status, 404);
});

test("explicit production demo flag exposes only fictional public DTOs", async () => {
  const r = await handleDiscovery(request({ scope: "today" }), { NODE_ENV: "production", COMMUNITY_DEMO_ENABLED: "true" });
  assert.equal(r.status, 200);
  const text = await r.text();
  for (const marker of ["SENTINEL", "private-fixture", "draft-fixture", "withdrawn-fixture", '"attendance"', '"visibility"']) assert.ok(!text.includes(marker), marker);
  assert.equal(r.headers.get("Cache-Control"), "private, no-store");
});

test("oversized and malformed request input is rejected", async () => {
  assert.equal((await handleDiscovery(request({ query: "a".repeat(241) }), dev)).status, 400);
  assert.equal((await handleDiscovery(request({ scope: "all-private" }), dev)).status, 400);
  const malformed = new Request("http://localhost:4000/api/community/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal((await handleDiscovery(malformed, dev)).status, 400);
  assert.equal((await handleDiscovery(request({ query: "x".repeat(20_000) }), dev)).status, 413);
});

test("cross-origin mutations are refused", async () => {
  assert.equal((await handleDiscovery(request({}, { Origin: "https://elsewhere.test" }), dev)).status, 403);
});

test("viewer input cannot replace server candidates or override eligibility", async () => {
  const r = await handleDiscovery(request({ scope: "today", candidates: [{ name: "Injected" }], query: "Private sentinel", sessionId: "secret" }), dev);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).matches.length, 0);
});

test("source consent is required even for the sample adapter", async () => {
  assert.equal((await handleImport(request({ mode: "sample", consent: false }), dev)).status, 403);
  const allowed = await handleImport(request({ mode: "sample", consent: true }), dev);
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).source, "sample-github");
});

test("live import needs its own flag and is always closed in production", async () => {
  assert.equal((await handleImport(request({ mode: "public", consent: true, username: "demo-maker" }), dev)).status, 403);
  assert.equal((await handleImport(request({ mode: "public", consent: true, username: "demo-maker" }), { NODE_ENV: "production", COMMUNITY_DEMO_ENABLED: "true", COMMUNITY_GITHUB_IMPORT_ENABLED: "true" })).status, 403);
});
