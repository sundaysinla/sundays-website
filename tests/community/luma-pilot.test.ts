import test from "node:test";
import assert from "node:assert/strict";
import { LumaIntake, CONSENT_QUESTION, LINK_QUESTION, type IntakeEvent } from "../../lib/community/pilot/intake.ts";

const eventId = "evt-FakeEvent";
const start = "2026-11-22T22:00:00.000Z";
const event = (questions: unknown[]) => ({
  id: eventId, name: "Sunday studio", start_at: start, end_at: "2026-11-23T02:00:00.000Z",
  timezone: "America/Los_Angeles", registration_questions: questions,
});
const project = { id: "project", label: "what are you working on?", question_type: "text", required: true };
const opt = { id: "share", label: CONSENT_QUESTION, question_type: "agree-check", required: false };
const link = { id: "link", label: LINK_QUESTION, question_type: "url", required: false };
const response = (data: unknown) => Response.json(data);
const answer = (id: string, question_type: string, value: unknown) => ({ question_id: id, question_type, value });
function guest(id: string, consent: unknown, checkedIn = true, tickets = 1) {
  return {
    id, user_id: "private-user-id", user_name: "Avery Sample", user_email: "private@example.test",
    phone_number: "+15550000000", check_in_qr_code: "private-ticket", approval_status: "approved",
    registration_answers: [
      answer("share", "agree-check", consent),
      answer("project", "text", "A short film. I could use help with sound design."),
      answer("link", "url", "https://github.com/example?secret=private#contact"),
      answer("unrelated", "text", "PRIVATE-SENTINEL"),
    ],
    event_tickets: Array.from({ length: tickets }, () => ({ checked_in_at: checkedIn ? start : null })),
  };
}

test("a real event lacking the exact optional consent question never triggers a guest request", async () => {
  for (const questions of [[project], [project, { ...opt, required: true }], [project, opt, { ...opt, id: "duplicate" }]]) {
    const calls: string[] = [];
    const adapter = new LumaIntake("test-key", async input => {
      calls.push(new URL(String(input)).pathname);
      return response({ event: event(questions) });
    });
    await assert.rejects(() => adapter.snapshot(eventId), /optional intro-card opt-in/i);
    assert.deepEqual(calls, ["/v1/events/get"]);
  }
});

test("pagination keeps only approved, opted-in guests; contact, ticket and unrelated answers never enter drafts", async () => {
  const calls: URL[] = [];
  const adapter = new LumaIntake("test-key", async (input, init) => {
    const url = new URL(String(input)); calls.push(url);
    assert.equal(url.origin, "https://public-api.luma.com");
    assert.equal(new Headers(init?.headers).get("x-luma-api-key"), "test-key");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    if (url.pathname.endsWith("/get")) return response({ event: event([project, opt, link]) });
    if (url.searchParams.get("pagination_cursor") === "next") return response({
      entries: [guest("gst-3", true, true, 2), { ...guest("gst-4", true), approval_status: "waitlist" }],
      has_more: false,
    });
    return response({ entries: [guest("gst-1", true), guest("gst-2", "true")], has_more: true, next_cursor: "next" });
  });
  const result = await adapter.snapshot(eventId);
  assert.equal(calls.length, 3);
  assert.equal(result.guests.length, 2);
  assert.deepEqual(result.guests.map(g => g.attendance), ["checked-in", "rsvp"]);
  assert.equal(result.guests[0].draft.ask, "sound design");
  assert.equal(result.guests[0].draft.offer, "");
  assert.equal(result.guests[0].draft.link, "https://github.com/example");
  assert.equal(result.guests[0].draft.shareLink, false);
  const stored = JSON.stringify(result);
  for (const privateValue of ["private@example.test", "15550000000", "private-ticket", "private-user-id", "PRIVATE-SENTINEL", "gst-1"]) {
    assert.ok(!stored.includes(privateValue), privateValue);
  }
});

test("an incomplete or repeating pagination cursor fails the snapshot", async () => {
  const adapter = new LumaIntake("test-key", async input =>
    String(input).includes("/events/get") ? response(event([project, opt])) :
      response({ entries: [], has_more: true, next_cursor: "repeat" }));
  await assert.rejects(() => adapter.snapshot(eventId), /complete guest list/i);
});

test("event metadata is inspectable without returning raw responses or fetching the roster", async () => {
  const adapter = new LumaIntake("test-key", async input => {
    assert.equal(new URL(String(input)).pathname, "/v1/events/get");
    return response({ ...event([project]), ticket_secret: "DO-NOT-RETURN" });
  });
  const result: IntakeEvent = await adapter.event(eventId);
  assert.equal(result.source, "luma");
  assert.equal(result.projectQuestion?.id, "project");
  assert.equal(result.consentQuestion, null);
  assert.ok(!JSON.stringify(result).includes("DO-NOT-RETURN"));
});

test("a non-opted-in RSVP with the same name makes a claim ambiguous without saving their data", async () => {
  const adapter = new LumaIntake("test-key", async input => {
    if (String(input).includes("/events/get")) return response(event([project, opt]));
    return response({ entries: [guest("gst-1", true), guest("gst-2", false)], has_more: false });
  });
  const result = await adapter.snapshot(eventId);
  assert.equal(result.guests.length, 1);
  assert.equal(result.guests[0].claimBlocked, true);
});
