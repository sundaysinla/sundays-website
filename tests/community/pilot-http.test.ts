import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePilot } from "../../lib/community/pilot/handlers.ts";
import { PilotStore } from "../../lib/community/pilot/store.ts";

const base = "http://localhost:4000";
const hostKey = "fixture-only-host-key-with-at-least-32-bytes";
const env = { COMMUNITY_PILOT_ENABLED: "true", COMMUNITY_PILOT_HOST_KEY: hostKey };
function harness(t: TestContext, flags: Record<string, string> = {}, fetcher?: typeof fetch) {
  const dir = mkdtempSync(join(tmpdir(), "sundays-http-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = new PilotStore(join(dir, "pilot.sqlite"));
  return (body: unknown, cookie = "", origin = base, url = base, host?: string) => handlePilot(new Request(url + "/api/community/pilot", {
    method: "POST", headers: { "content-type": "application/json", origin, cookie, ...(host ? { host } : {}) }, body: JSON.stringify(body),
  }), { env: { ...env, ...flags }, store, fetcher });
}
const cookie = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

test("pilot routes reject disabled, hosted, off-host, cross-origin and anonymous admin requests", async t => {
  const login = { action: "host-login", key: hostKey };
  assert.equal((await harness(t, { COMMUNITY_PILOT_ENABLED: "false" })(login)).status, 404);
  assert.equal((await harness(t, { VERCEL: "1" })(login)).status, 404);
  const request = harness(t);
  assert.equal((await request(login, "", "http://example.test", "http://example.test")).status, 404);
  assert.equal((await request(login, "", "https://another.test")).status, 403);
  assert.equal((await request({ action: "host-view" })).status, 401);
  assert.equal((await request({ action: "host-login", key: "wrong" })).status, 401);
});

test("the pilot uses the verified loopback Host for same-origin checks", async t => {
  const request = harness(t);
  const login = { action: "host-login", key: hostKey };
  assert.equal((await request(login, "", "http://127.0.0.1:4000", base, "127.0.0.1:4000")).status, 200);
  assert.equal((await request(login, "", "http://localhost:4002", base, "localhost:4000")).status, 403);
  assert.equal((await request(login, "", base, base, "example.test:4000")).status, 404);
});

test("the host can inspect a live event, but a missing opt-in prevents any roster read", async t => {
  const paths: string[] = [];
  const request = harness(t, { LUMA_API_KEY: "fake-provider-key", COMMUNITY_PILOT_LUMA_EVENT_ID: "evt-RealLike" }, async input => {
    paths.push(new URL(String(input)).pathname);
    return Response.json({
      id: "evt-RealLike", name: "Sunday studio", timezone: "America/Los_Angeles",
      start_at: "2026-11-22T22:00:00Z", end_at: "2026-11-23T02:00:00Z", registration_questions: [],
    });
  });
  const host = cookie(await request({ action: "host-login", key: hostKey }));
  assert.ok(host);
  assert.equal((await request({ action: "host-inspect" }, host)).status, 200);
  assert.equal((await request({ action: "host-sync", source: "luma" }, host)).status, 409);
  assert.deepEqual(paths, ["/v1/events/get", "/v1/events/get"]);
});

test("sample intake through review and discovery uses separate, private host and member sessions", async t => {
  const request = harness(t);
  const login = await request({ action: "host-login", key: hostKey });
  assert.match(login.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Strict/);
  assert.equal(login.headers.get("cache-control"), "private, no-store");
  const host = cookie(login);
  const seeded = await request({ action: "host-sync", source: "sample" }, host);
  assert.equal(seeded.status, 200);
  const data = await seeded.json();
  const selected = data.events[0];
  const issue = async (name: string) => {
    const guest = selected.guests.find((g: { name: string }) => g.name === name);
    const link = await request({ action: "host-issue", eventId: selected.event.id, guestId: guest.id }, host);
    const { claimPath } = await link.json();
    const token = claimPath.split("#")[1];
    const claimed = await request({ action: "claim", token });
    assert.equal(claimed.status, 200);
    assert.equal((await request({ action: "claim", token })).status, 403);
    assert.doesNotMatch(await claimed.text(), new RegExp(token));
    return cookie(claimed);
  };
  const alex = await issue("Alex Rivera");
  const jamie = await issue("Jamie Okafor");
  const alexView = await (await request({ action: "card" }, alex)).json();
  const own = await (await request({ action: "card" }, jamie)).json();
  assert.equal(own.card.name, "Jamie Okafor");
  assert.equal((await request({ action: "host-view" }, jamie)).status, 401);
  assert.equal((await request({ action: "discover", query: "", context: alexView.context }, host)).status, 401);
  assert.equal((await request({ action: "share", card: own.card, context: own.context, guestId: "alex" }, jamie)).status, 400);
  assert.equal((await request({ action: "share", card: own.card, context: own.context }, alex)).status, 401, "a stale tab cannot publish under a new claim cookie");
  const shared = await request({ action: "share", context: own.context, card: { ...own.card, offer: "sound design" } }, jamie);
  assert.equal(shared.status, 200);
  const introductions = await (await request({ action: "discover", query: "", context: alexView.context }, alex)).json();
  assert.deepEqual(introductions.matches.map((m: {member:{name:string}}) => m.member.name), ["Jamie Okafor"]);
  assert.equal((await request({ action: "hide", context: own.context }, jamie)).status, 200);
  assert.deepEqual((await (await request({ action: "discover", query: "", context: alexView.context }, alex)).json()).matches, []);
});
