import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Card, IntakeEvent, IntakeSnapshot } from "../../lib/community/pilot/intake.ts";
import { PilotStore, CLAIM_TTL_MS } from "../../lib/community/pilot/store.ts";

const now = Date.parse("2026-11-22T23:00:00Z");
const event: IntakeEvent = {
  id: "evt-Pilot", source: "luma", name: "Sundays", startAt: "2026-11-22T22:00:00Z",
  endAt: "2026-11-23T02:00:00Z", timezone: "America/Los_Angeles",
  consentQuestion: { id: "consent", label: "Consent" }, projectQuestion: null, linkQuestion: null,
};
const card = (name: string, project: string, ask = "", offer = ""): Card => ({
  name, project, ask, offer, link: "https://github.com/example", shareLink: false,
});
const sample = (source = event, stamp = now): IntakeSnapshot => ({
  event: source, startedAt: stamp - 10, syncedAt: stamp,
  guests: [
    { id: "alex", attendance: "checked-in", draft: card("Alex", "A short film", "sound design") },
    { id: "jamie", attendance: "checked-in", draft: card("Jamie", "A music project", "", "sound design") },
    { id: "rowan", attendance: "rsvp", draft: card("Rowan", "An interface design project", "", "motion design") },
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

test("draft approval and exact-event check-in are independent discovery gates", t => {
  const store = make(t);
  const alex = claim(store, "alex");
  const jamie = claim(store, "jamie");
  const rowan = claim(store, "rowan");
  assert.deepEqual(store.introductions(alex, "", now).matches, []);
  store.share(jamie, card("Jamie", "A music project", "", "sound design"), now);
  store.share(rowan, card("Rowan", "An interface design project", "", "motion design"), now);
  const result = store.introductions(alex, "", now);
  assert.deepEqual(result.matches.map(m => m.member.name), ["Jamie"]);
  assert.match(result.matches[0].reason, /offers sound design/);
  assert.doesNotMatch(JSON.stringify(result), /github\.com\/example|evt-Pilot|checked-in/);
  assert.throws(() => store.introductions(rowan, "", now), /check.*in/i);
  store.sync(sample({ ...event, id: "evt-Other" }));
  const foreign = claim(store, "jamie", "evt-Other");
  store.share(foreign, card("Other Event", "A music project", "", "sound design"), now);
  assert.deepEqual(store.introductions(alex, "", now).matches.map(m => m.member.name), ["Jamie"]);
});

test("claims are single use, expire, and only expose the claimed card", t => {
  const store = make(t);
  const link = store.issue(event.id, "alex", now);
  const session = store.claim(link, now);
  assert.equal(store.view(session, now).card.name, "Alex");
  assert.throws(() => store.claim(link, now), /invalid or expired/i);
  const expired = store.issue(event.id, "jamie", now);
  assert.throws(() => store.claim(expired, now + CLAIM_TTL_MS + 1), /invalid or expired/i);
  assert.throws(() => store.view("bad-session", now), /claim/i);
});

test("refresh preserves approved edits and removes a guest when their consent disappears", t => {
  const store = make(t);
  const alex = claim(store, "alex");
  const jamie = claim(store, "jamie");
  store.share(jamie, { ...card("Jamie Edited", "A music project", "", "sound design"), shareLink: true }, now);
  store.sync(sample(event, now + 20));
  const afterRefresh = store.introductions(alex, "", now + 20);
  assert.equal(afterRefresh.matches[0].member.name, "Jamie Edited");
  assert.equal(afterRefresh.matches[0].member.link, "https://github.com/example");
  const removed = sample(event, now + 40);
  removed.guests = removed.guests.filter(g => g.id !== "jamie");
  store.sync(removed);
  assert.deepEqual(store.introductions(alex, "", now + 40).matches, []);
  assert.throws(() => store.view(jamie, now + 40), /claim/i);
  assert.throws(() => store.sync(sample(event, now + 30)), /newer/i);
});

test("hiding keeps the member’s edits; withdrawing prevents a later sync from restoring the card", t => {
  const store = make(t);
  const alex = claim(store, "alex");
  const jamie = claim(store, "jamie");
  store.share(jamie, card("Jamie Edited", "A music project"), now);
  store.hide(jamie, now);
  assert.equal(store.view(jamie, now).card.name, "Jamie Edited");
  assert.equal(store.view(jamie, now).shared, false);
  assert.equal(store.introductions(alex, "", now).matches.length, 0);
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

test("a consent block before first import wins over older or same-time snapshots", t => {
  const path = mkdtempSync(join(tmpdir(), "sundays-block-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  const store = new PilotStore(join(path, "pilot.sqlite"));
  store.block(event.id, now);
  const late = { ...sample(), startedAt: now, syncedAt: now + 20 };
  assert.throws(() => store.sync(late), /newer.*consent/i);
  assert.deepEqual(store.hostEvents(), []);
  store.sync({ ...late, startedAt: now + 1 });
  assert.equal(store.hostEvents()[0].blocked, false);
});

test("host handoff uses RSVP names rather than editable display names", t => {
  const store = make(t);
  store.share(claim(store, "jamie"), card("Alex", "A music project"), now);
  assert.equal(store.hostEvents()[0].guests.find(g => g.id === "jamie")?.name, "Jamie");
});

test("ambiguous RSVP names cannot receive a claim link", t => {
  const store = make(t);
  const duplicate = sample(event, now + 1);
  duplicate.guests[1].draft.name = " alex ";
  store.sync(duplicate);
  assert.throws(() => store.issue(event.id, "alex", now + 1), /same RSVP name/i);
});
