import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePilot, type PilotOptions } from "../../lib/community/pilot/handlers.ts";
import { PilotStore } from "../../lib/community/pilot/store.ts";

const base = "http://localhost:4000";
const hostKey = "fixture-only-host-key-with-at-least-32-bytes";
const env = { COMMUNITY_PILOT_ENABLED: "true", COMMUNITY_PILOT_HOST_KEY: hostKey };
function harness(t: TestContext, flags: Record<string, string> = {}, fetcher?: typeof fetch, portfolioReader?: PilotOptions["portfolioReader"]) {
  const dir = mkdtempSync(join(tmpdir(), "sundays-http-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = new PilotStore(join(dir, "pilot.sqlite"));
  return (body: unknown, cookie = "", origin = base, url = base, host?: string) => handlePilot(new Request(url + "/api/community/pilot", {
    method: "POST", headers: { "content-type": "application/json", origin, cookie, ...(host ? { host } : {}) }, body: JSON.stringify(body),
  }), { env: { ...env, ...flags }, store, fetcher, portfolioReader });
}
const cookie = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

test("a visitor can search the sample room and see pairings without signing in", async t => {
  const request = harness(t, { COMMUNITY_PILOT_HOST_KEY: "" });
  const response = await request({ action: "directory", query: "Blender" });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.people.map((person: { card: { name: string } }) => person.card.name), ["Casey Lin"]);
  assert.ok(result.matches.some((match: { person: { card: { name: string } } }) => match.person.card.name === "Jamie Okafor"));
  assert.equal(response.headers.get("set-cookie"), null);
  assert.doesNotMatch(JSON.stringify(result), /Sam Adeyemi/);
});

test("a real room uses event-scoped Luma tickets for personal pairing and an explicit directory share", async t => {
  const id = "evt-TicketTest";
  const now = Date.now();
  const lookupIds: string[] = [];
  let listed = 0;
  const alex = {
    id: "gst-Alex", user_name: "Alex Rivera", approval_status: "approved", user_email: "alex@example.test",
    registration_answers: [{ question_id: "project", question_type: "text", value: "Editing a short documentary." }],
    event_tickets: [{ checked_in_at: new Date(now).toISOString() }],
  };
  const jamie = {
    ...alex, id: "gst-Jamie", user_name: "Jamie Okafor", user_email: "jamie@example.test",
    registration_answers: [{ question_id: "project", question_type: "text", value: "Scoring short films." }],
  };
  const request = harness(t, { COMMUNITY_PILOT_LIVE: "true", LUMA_API_KEY: "test-key", COMMUNITY_PILOT_LUMA_EVENT_ID: id, COMMUNITY_PILOT_HOST_KEY: "" }, async input => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://public-api.luma.com");
    assert.equal(url.searchParams.get("event_id"), id);
    if (url.pathname === "/v1/events/get") return Response.json({
      id, name: "Luma ticket test", timezone: "America/Los_Angeles", start_at: new Date(now - 60_000).toISOString(),
      end_at: new Date(now + 60 * 60_000).toISOString(),
      registration_questions: [{ id: "project", label: "What are you working on?", question_type: "text", required: true }],
    });
    if (url.pathname === "/v1/events/guests/list") {
      listed++;
      return Response.json({ entries: [alex, jamie], has_more: false });
    }
    assert.equal(url.pathname, "/v1/events/guests/get");
    const identifier = url.searchParams.get("id")!;
    lookupIds.push(identifier);
    if (["g-ticketalex", alex.id].includes(identifier)) return Response.json(alex);
    if (["g-ticketjamie", jamie.id].includes(identifier)) return Response.json(jamie);
    if (identifier === "g-invalidticket") return Response.json({ ...jamie, is_ticket_key_invalidated: true });
    return Response.json({}, { status: 404 });
  });
  const directory = (query = "", member = "") => request({ action: "directory", query }, member).then(res => res.json());
  const join = (pk: string, eventId = id) => request({ action: "join", ticket: "https://luma.com/check-in/" + eventId + "?pk=" + pk });
  assert.deepEqual((await directory()).people, []);
  assert.equal(listed, 1);
  assert.equal((await join("gst-Jamie")).status, 400);
  assert.equal((await join("g-ticketjamie", "evt-Other")).status, 400);
  assert.deepEqual(lookupIds, []);
  assert.equal((await join("g-invalidticket")).status, 403);
  for (let i = 0; i < 12; i++) assert.equal((await join("g-unrecognized" + i)).status, 403);
  const joinedJamie = await join("g-ticketjamie");
  assert.equal(joinedJamie.status, 200);
  assert.doesNotMatch(await joinedJamie.clone().text(), /ticketjamie|jamie@example\.test|Scoring short films/);
  const jamieView = await joinedJamie.json();
  const jamieCookie = cookie(joinedJamie);
  const preparedJamie = await request({ action: "prepare", context: jamieView.context }, jamieCookie).then(res => res.json());
  assert.deepEqual((await directory()).people, []);
  assert.equal((await request({
    action: "share", context: jamieView.context, revision: preparedJamie.revision, includePortfolio: false, directory: true,
  }, jamieCookie)).status, 200);
  assert.deepEqual((await directory("Scoring")).people.map((person: { card: { name: string } }) => person.card.name), ["Jamie Okafor"]);
  assert.deepEqual((await directory()).matches, []);

  const joinedAlex = await join("g-ticketalex");
  assert.equal(joinedAlex.status, 200);
  const alexView = await joinedAlex.json();
  const alexCookie = cookie(joinedAlex);
  await request({ action: "prepare", context: alexView.context }, alexCookie);
  const paired = await request({ action: "directory", query: "casey", context: alexView.context }, alexCookie).then(res => res.json());
  assert.deepEqual(paired.people, []);
  assert.equal(paired.matches[0]?.person.card.name, "Jamie Okafor");
  assert.equal(paired.matches[0]?.topic, "short films");
  assert.equal(listed, 1, "the automatic roster refresh is shared");

  await request({ action: "hide", context: jamieView.context }, jamieCookie);
  assert.deepEqual((await directory()).people, []);
});

test("opening search before the event does not fetch the roster or resolve a ticket", async t => {
  const id = "evt-FutureRoom";
  const paths: string[] = [];
  const start = Date.now() + 24 * 60 * 60_000;
  const request = harness(t, { COMMUNITY_PILOT_LIVE: "true", LUMA_API_KEY: "test-key", COMMUNITY_PILOT_LUMA_EVENT_ID: id }, async input => {
    paths.push(new URL(String(input)).pathname);
    return Response.json({
      id, name: "Future Sunday", timezone: "America/Los_Angeles", start_at: new Date(start).toISOString(),
      end_at: new Date(start + 60 * 60_000).toISOString(),
      registration_questions: [{ id: "project", label: "What are you working on?", question_type: "text", required: true }],
    });
  });
  const response = await request({ action: "directory" });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).people, []);
  const joined = await request({ action: "join", ticket: "https://luma.com/check-in/" + id + "?pk=g-futureguest" });
  assert.equal(joined.status, 409);
  assert.deepEqual(paths, ["/v1/events/get"]);
});

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

test("the host can inspect a live event, but a missing project question prevents a roster read", async t => {
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
  assert.equal(own.name, "Jamie Okafor");
  assert.equal(own.card, null);
  assert.equal((await request({ action: "host-view" }, jamie)).status, 401);
  assert.equal((await request({ action: "discover", query: "", context: alexView.context }, host)).status, 401);
  const preview = await (await request({ action: "prepare", context: own.context }, jamie)).json();
  assert.match(preview.card.portfolio.excerpts[0].text, /scores for two short films/);
  const share = { action: "share", context: own.context, revision: preview.revision, includePortfolio: true };
  assert.equal((await request({ ...share, card: { name: "Alex" } }, jamie)).status, 400);
  assert.equal((await request(share, alex)).status, 401, "a stale tab cannot publish under a new claim cookie");
  const shared = await request(share, jamie);
  assert.equal(shared.status, 200);
  const sharedCard = await shared.json();
  const discover = () => request({ action: "discover", query: "", context: alexView.context }, alex).then(res => res.json());
  const browsing = await discover();
  assert.equal(browsing.people[0].card.name, "Jamie Okafor");
  assert.deepEqual(browsing.matches, []);
  await request({ action: "prepare", context: alexView.context }, alex);
  const introductions = await discover();
  assert.equal(introductions.matches[0].person.card.name, "Jamie Okafor");
  assert.equal(introductions.matches[0].topic, "short films");
  const exclude = await request({ ...share, revision: sharedCard.revision, includePortfolio: false }, jamie);
  assert.equal(exclude.status, 200);
  const projectOnly = await discover();
  assert.equal(projectOnly.people[0].card.portfolio, null);
  assert.deepEqual(projectOnly.matches, []);
  assert.equal((await request({ action: "hide", context: own.context }, jamie)).status, 200);
  assert.deepEqual((await discover()).people, []);
});

test("Luma-backed preview reads only the claimed RSVP and its submitted portfolio after consent", async t => {
  const calls: string[] = [];
  const eventId = "evt-RealLike";
  const guestId = "gst-Jamie";
  const portfolioUrl = "https://jamie.example.com/";
  const now = Date.now();
  const guest = {
    id: guestId, user_name: "Jamie", user_email: "jamie@private.example", approval_status: "approved",
    event_tickets: [{ checked_in_at: new Date(now).toISOString() }],
    registration_answers: [
      { question_id: "project", question_type: "text", value: "Making a documentary about quiet parks." },
      { question_id: "website", question_type: "url", value: portfolioUrl },
    ],
  };
  const another = { ...guest, id: "gst-Other", user_name: "Other person" };
  const lookupStarted = Promise.withResolvers<void>();
  const releaseLookup = Promise.withResolvers<void>();
  const request = harness(t, { LUMA_API_KEY: "fake-provider-key", COMMUNITY_PILOT_LUMA_EVENT_ID: eventId }, async input => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    assert.equal(url.searchParams.get("event_id"), eventId);
    switch (url.pathname) {
      case "/v1/events/get": return Response.json({
        id: eventId, name: "Sunday studio", timezone: "America/Los_Angeles",
        start_at: new Date(now - 60_000).toISOString(), end_at: new Date(now + 60 * 60_000).toISOString(),
        registration_questions: [
          { id: "project", label: "What are you working on? (Keep it short.)", question_type: "text", required: true },
          { id: "website", label: "Website or portfolio", question_type: "url", required: false },
        ],
      });
      case "/v1/events/guests/list": return Response.json({ entries: [guest, another], has_more: false });
      case "/v1/events/guests/get":
        if (url.searchParams.get("id") === another.id) {
          lookupStarted.resolve();
          await releaseLookup.promise;
          return Response.json(another);
        }
        assert.equal(url.searchParams.get("id"), guestId);
        return Response.json(guest);
      default: throw new Error("Unexpected Luma request");
    }
  }, async url => {
    assert.equal(url, portfolioUrl);
    calls.push("read portfolio");
    return null;
  });
  const host = cookie(await request({ action: "host-login", key: hostKey }));
  const synced = await request({ action: "host-sync", source: "luma" }, host);
  assert.equal(synced.status, 200);
  const roster = await synced.text();
  assert.doesNotMatch(roster, /gst-Jamie|quiet parks|jamie\.example|private\.example/);
  const id = JSON.parse(roster).events[0].guests[0].id;
  const { claimPath } = await (await request({ action: "host-issue", eventId, guestId: id }, host)).json();
  const claimed = await request({ action: "claim", token: claimPath.split("#")[1] });
  const member = cookie(claimed);
  const view = await claimed.json();
  assert.equal(view.card, null);
  assert.deepEqual(calls, ["/v1/events/get", "/v1/events/guests/list"]);
  assert.equal((await request({ action: "prepare", context: view.context }, host)).status, 401);
  const prepare = () => request({ action: "prepare", context: view.context }, member).then(res => res.json());
  const [first, second] = await Promise.all([prepare(), prepare()]);
  assert.equal(first.card.project, "Making a documentary about quiet parks.");
  assert.equal(first.portfolioUnavailable, true);
  assert.equal(first.shared, false);
  assert.equal(second.revision, first.revision);
  assert.equal((await prepare()).revision, first.revision);
  assert.deepEqual(calls, ["/v1/events/get", "/v1/events/guests/list", "/v1/events/guests/get", "read portfolio"]);
  assert.equal((await request({ action: "share", context: view.context, revision: first.revision, includePortfolio: false }, member)).status, 200);

  const otherId = JSON.parse(roster).events[0].guests[1].id;
  const otherClaim = await (await request({ action: "host-issue", eventId, guestId: otherId }, host)).json();
  const other = await request({ action: "claim", token: otherClaim.claimPath.split("#")[1] });
  const otherContext = (await other.json()).context;
  const pending = request({ action: "prepare", context: otherContext }, cookie(other));
  await lookupStarted.promise;
  const withdrawn = await request({ action: "withdraw", context: otherContext }, cookie(other));
  releaseLookup.resolve();
  assert.equal(withdrawn.status, 200);
  assert.equal((await pending).status, 401);
  assert.equal(calls.filter(call => call === "read portfolio").length, 1);
});
