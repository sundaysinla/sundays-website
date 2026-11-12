import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IntakeEvent, IntakeSnapshot } from "../../lib/community/pilot/intake.ts";
import type { Portfolio } from "../../lib/community/pilot/portfolio.ts";
import { PilotStore, CLAIM_TTL_MS } from "../../lib/community/pilot/store.ts";

const now = Date.parse("2026-11-22T23:00:00Z");
const event: IntakeEvent = {
  id: "evt-Pilot", source: "luma", name: "Sundays", startAt: "2026-11-22T22:00:00Z",
  endAt: "2026-11-23T02:00:00Z", timezone: "America/Los_Angeles",
  projectQuestion: { id: "project", label: "What are you working on?" }, linkQuestion: null,
};
const portfolio: Portfolio = { url: "https://example.com/", excerpts: [{ url: "https://example.com/", text: "Scored two short films." }] };
const sample = (source = event, stamp = now): IntakeSnapshot => ({
  event: source, startedAt: stamp - 10, syncedAt: stamp,
  guests: [
    { id: "alex", name: "Alex", attendance: "checked-in", revision: "alex-v1", source: { kind: "luma", guestId: "gst-Alex" } },
    { id: "jamie", name: "Jamie", attendance: "checked-in", revision: "jamie-v1", source: { kind: "luma", guestId: "gst-Jamie" } },
    { id: "rowan", name: "Rowan", attendance: "rsvp", revision: "rowan-v1", source: { kind: "luma", guestId: "gst-Rowan" } },
  ],
});
function make(t: TestContext) {
  const path = mkdtempSync(join(tmpdir(), "sundays-store-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  const store = new PilotStore(join(path, "pilot.sqlite"));
  store.sync(sample());
  return store;
}
function claim(store: PilotStore, id: string, eventId = event.id) {
  return store.claim(store.issue(eventId, id, now), now);
}

function prepare(store: PilotStore, session: string, project: string, link: Portfolio | null = null, at = now) {
  store.savePreparation(session, store.preparation(session, at), { project, portfolio: link, portfolioUnavailable: false }, at);
  return store.view(session, at).revision!;
}

test("draft approval and exact-event check-in are independent discovery gates", t => {
  const store = make(t);
  const alex = claim(store, "alex");
  const jamie = claim(store, "jamie");
  const rowan = claim(store, "rowan");
  prepare(store, alex, "Editing a short documentary.");
  const reviewed = prepare(store, jamie, "Making music.", portfolio);
  assert.deepEqual(store.introductions(alex, "", now).people, []);
  store.share(jamie, reviewed, true, now);
  store.share(rowan, prepare(store, rowan, "Building a short film set."), false, now);
  const result = store.introductions(alex, "", now);
  assert.deepEqual(result.people.map(person => person.card.name), ["Jamie"]);
  assert.equal(result.matches[0]?.topic, "short films");
  assert.doesNotMatch(JSON.stringify(result), /gst-Jamie|evt-Pilot|checked-in/);
  assert.throws(() => store.introductions(rowan, "", now), /check.*in/i);
  store.sync(sample({ ...event, id: "evt-Other" }));
  const foreign = claim(store, "jamie", "evt-Other");
  store.share(foreign, prepare(store, foreign, "Editing a short film."), false, now);
  assert.deepEqual(store.introductions(alex, "", now).people.map(person => person.card.name), ["Jamie"]);
});

test("claims are single use, expire, and only expose the claimed card", t => {
  const store = make(t);
  const link = store.issue(event.id, "alex", now);
  const session = store.claim(link, now);
  assert.equal(store.view(session, now).name, "Alex");
  assert.equal(store.view(session, now).card, null);
  assert.throws(() => store.claim(link, now), /invalid or expired/i);
  const expired = store.issue(event.id, "jamie", now);
  assert.throws(() => store.claim(expired, now + CLAIM_TTL_MS + 1), /invalid or expired/i);
  assert.throws(() => store.view("bad-session", now), /claim/i);
});

test("refresh preserves a shared preview while its RSVP is unchanged and removes cancelled guests", t => {
  const store = make(t);
  const alex = claim(store, "alex");
  const jamie = claim(store, "jamie");
  store.share(jamie, prepare(store, jamie, "Making music.", portfolio), true, now);
  store.sync(sample(event, now + 20));
  const afterRefresh = store.introductions(alex, "", now + 20);
  assert.equal(afterRefresh.people[0].card.name, "Jamie");
  assert.equal(afterRefresh.people[0].card.portfolio?.url, "https://example.com/");
  const removed = sample(event, now + 40);
  removed.guests = removed.guests.filter(g => g.id !== "jamie");
  store.sync(removed);
  assert.deepEqual(store.introductions(alex, "", now + 40).people, []);
  assert.throws(() => store.view(jamie, now + 40), /claim/i);
  assert.throws(() => store.sync(sample(event, now + 30)), /newer/i);
});

test("a changed RSVP clears visibility and rejects an older preview or in-flight preparation", t => {
  const store = make(t);
  const alex = claim(store, "alex");
  const jamie = claim(store, "jamie");
  const revision = prepare(store, jamie, "Making music.", portfolio);
  const inFlight = store.preparation(jamie, now);
  store.share(jamie, revision, true, now);
  const changed = sample(event, now + 20);
  changed.guests[1].revision = "jamie-v2";
  store.sync(changed);
  assert.equal(store.view(jamie, now + 20).card, null);
  assert.deepEqual(store.introductions(alex, "", now + 20).people, []);
  assert.throws(() => store.share(jamie, revision, true, now + 20), /preview/i);
  assert.throws(() => store.savePreparation(jamie, inFlight, { project: "Old note", portfolio, portfolioUnavailable: false }, now + 20), /RSVP changed/i);
});

test("hiding keeps the private preview and withdrawal prevents a later sync restoring it", t => {
  const store = make(t);
  const alex = claim(store, "alex");
  const jamie = claim(store, "jamie");
  const initial = prepare(store, jamie, "A music project", portfolio);
  store.share(jamie, initial, true, now);
  const withPortfolio = store.view(jamie, now).revision!;
  store.share(jamie, withPortfolio, false, now);
  assert.throws(() => store.share(jamie, withPortfolio, true, now), /preview/i);
  const withoutPortfolio = store.view(jamie, now).revision!;
  store.hide(jamie, now);
  assert.throws(() => store.share(jamie, withoutPortfolio, true, now), /preview/i);
  assert.equal(store.view(jamie, now).card?.project, "A music project");
  assert.equal(store.view(jamie, now).shared, false);
  assert.equal(store.view(jamie, now).includePortfolio, false);
  assert.equal(store.introductions(alex, "", now).people.length, 0);
  store.withdraw(jamie, now);
  store.sync(sample(event, now + 1));
  assert.throws(() => store.issue(event.id, "jamie", now + 1), /guest/i);
  assert.throws(() => store.view(jamie, now + 1), /claim/i);
});

test("a live attendance snapshot expires and cannot be used outside the session", t => {
  const store = make(t);
  const alex = claim(store, "alex");
  assert.equal(store.introductions(alex, "", now).expiresAt, now + 60_000);
  assert.throws(() => store.introductions(alex, "", now - 3 * 60 * 60_000), /session/i);
  assert.throws(() => store.introductions(alex, "", now + 16 * 60_000), /refresh/i);
});

test("a form block before first import wins over older or same-time snapshots", t => {
  const path = mkdtempSync(join(tmpdir(), "sundays-block-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  const store = new PilotStore(join(path, "pilot.sqlite"));
  store.block(event.id, now);
  const late = { ...sample(), startedAt: now, syncedAt: now + 20 };
  assert.throws(() => store.sync(late), /newer.*event/i);
  assert.deepEqual(store.hostEvents(), []);
  store.sync({ ...late, startedAt: now + 1 });
  assert.equal(store.hostEvents()[0].blocked, false);
});

test("ambiguous RSVP names cannot receive a claim link", t => {
  const store = make(t);
  const alex = claim(store, "alex");
  const duplicate = sample(event, now + 1);
  duplicate.guests[1].name = " alex ";
  store.sync(duplicate);
  assert.throws(() => store.issue(event.id, "alex", now + 1), /same RSVP name/i);
  store.withdraw(alex, now + 2);
  assert.throws(() => store.issue(event.id, "jamie", now + 2), /same RSVP name/i);
});
