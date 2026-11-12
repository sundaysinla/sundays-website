import test from "node:test";
import assert from "node:assert/strict";
import { LumaIntake, LINK_QUESTION, type IntakeEvent } from "../../lib/community/pilot/intake.ts";

const eventId = "evt-FakeEvent";
const start = "2026-11-22T22:00:00.000Z";
const event = (questions: unknown[]) => ({
  id: eventId, name: "Sunday studio", start_at: start, end_at: "2026-11-23T02:00:00.000Z",
  timezone: "America/Los_Angeles", registration_questions: questions,
});
const project = { id: "project", label: "what are you working on?", question_type: "text", required: true };
const link = { id: "link", label: LINK_QUESTION, question_type: "url", required: false };
const response = (data: unknown) => Response.json(data);
const answer = (id: string, question_type: string, value: unknown) => ({ question_id: id, question_type, value });
function guest(id: string, checkedIn = true, tickets = 1) {
  return {
    id, user_id: "private-user-id", user_name: "Avery Sample", user_email: "private@example.test",
    phone_number: "+15550000000", check_in_qr_code: "private-ticket", approval_status: "approved",
    registration_answers: [
      answer("project", "text", "A short film about train stations. private@example.test"),
      answer("link", "url", "example.com/avery?utm_source=luma"),
      answer("unrelated", "text", "PRIVATE-SENTINEL"),
    ],
    event_tickets: Array.from({ length: tickets }, () => ({ checked_in_at: checkedIn ? start : null })),
  };
}

test("the project question can include event instructions and needs no extra checkbox or URL", async () => {
  const adapter = new LumaIntake("test-key", async input => {
    const path = new URL(String(input)).pathname;
    if (path === "/v1/events/get") return response(event([
      { ...project, label: "what are you working on? (please no HW or studying for midterms 🙂)" },
    ]));
    return response({ entries: [guest("gst-1")], has_more: false });
  });
  const result = await adapter.snapshot(eventId);
  assert.equal(result.event.projectQuestion?.id, "project");
  assert.equal(result.event.linkQuestion, null);
  assert.equal(result.guests.length, 1);
  assert.doesNotMatch(JSON.stringify(result.guests), /short film|example\.com|PRIVATE-SENTINEL/);
});

test("a missing or ambiguous project question never triggers a guest request", async () => {
  for (const questions of [[], [{ ...project, question_type: "company" }], [project, { ...project, id: "duplicate" }]]) {
    const calls: string[] = [];
    const adapter = new LumaIntake("test-key", async input => {
      calls.push(new URL(String(input)).pathname);
      return response({ event: event(questions) });
    });
    await assert.rejects(() => adapter.snapshot(eventId), /what are you working on/i);
    assert.deepEqual(calls, ["/v1/events/get"]);
  }
});

test("pagination keeps an approved private roster without storing project, portfolio or contact data", async () => {
  const calls: URL[] = [];
  const adapter = new LumaIntake("test-key", async (input, init) => {
    const url = new URL(String(input)); calls.push(url);
    assert.equal(url.origin, "https://public-api.luma.com");
    assert.equal(new Headers(init?.headers).get("x-luma-api-key"), "test-key");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    if (url.pathname.endsWith("/get")) return response({ event: event([project, link]) });
    assert.equal(url.searchParams.get("approval_status"), "approved");
    if (url.searchParams.get("pagination_cursor") === "next") return response({
      entries: [guest("gst-3", true, 2), { ...guest("gst-4"), approval_status: "waitlist" }],
      has_more: false,
    });
    return response({ entries: [guest("gst-1"), guest("gst-2", false)], has_more: true, next_cursor: "next" });
  });
  const result = await adapter.snapshot(eventId);
  assert.equal(calls.length, 3);
  assert.equal(result.guests.length, 3);
  assert.deepEqual(result.guests.map(g => g.attendance), ["checked-in", "rsvp", "rsvp"]);
  const stored = JSON.stringify(result);
  for (const privateValue of ["private@example.test", "15550000000", "private-ticket", "private-user-id", "PRIVATE-SENTINEL", "train stations", "example.com/avery"]) {
    assert.ok(!stored.includes(privateValue), privateValue);
  }
});

test("an incomplete or repeating pagination cursor fails the snapshot", async () => {
  const adapter = new LumaIntake("test-key", async input =>
    String(input).includes("/events/get") ? response(event([project])) :
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
  assert.equal(result.linkQuestion, null);
  assert.ok(!JSON.stringify(result).includes("DO-NOT-RETURN"));
});

test("the single guest lookup yields just the project and optional link and detects changes since sync", async () => {
  let current = guest("gst-1");
  const adapter = new LumaIntake("test-key", async input => {
    const url = new URL(String(input));
    if (url.pathname === "/v1/events/get") return response(event([project, link]));
    if (url.pathname === "/v1/events/guests/list") return response({ entries: [current], has_more: false });
    assert.equal(url.searchParams.get("event_id"), eventId);
    assert.equal(url.searchParams.get("id"), "gst-1");
    return response(current);
  });
  const result = await adapter.snapshot(eventId);
  assert.deepEqual(await adapter.cardSource(result.event, result.guests[0]), {
    project: "A short film about train stations.", link: "https://example.com/avery", portfolioSubmitted: true,
  });
  current = { ...current, registration_answers: [answer("project", "text", "Something completely new.")] };
  await assert.rejects(() => adapter.cardSource(result.event, result.guests[0]), /RSVP changed/i);
});
