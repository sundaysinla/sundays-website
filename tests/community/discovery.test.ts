import test from "node:test";
import assert from "node:assert/strict";
import { discover } from "../../lib/community/discovery.ts";
import { DEMO_MEMBERS, DEMO_VIEWER, DEMO_SESSION } from "../../lib/community/fixtures.ts";
import type { Member } from "../../lib/community/types.ts";

const options = { scope: "today" as const, sessionId: DEMO_SESSION.id };
const run = (query = "", extra = {}) => discover(DEMO_MEMBERS, DEMO_VIEWER, { ...options, query, ...extra });

test("never returns private, unreviewed, withdrawn, self or absent members in today's scope", () => {
  const result = run();
  const ids = result.matches.map(m => m.member.id);
  for (const id of ["alex", "private-fixture", "draft-fixture", "withdrawn-fixture", "sam", "devon", "avery"]) assert.ok(!ids.includes(id), id);
  assert.ok(ids.includes("maya"));
});

test("community scope excludes session-only consent and includes previous participants", () => {
  const ids = run("", { scope: "community" }).matches.map(m => m.member.id);
  assert.ok(ids.includes("sam"));
  assert.ok(ids.includes("devon"));
  assert.ok(!ids.includes("sol"));
});

test("RSVP alone and another session's check-in do not establish presence", () => {
  const members: Member[] = [
    { ...DEMO_MEMBERS[1], id: "rsvp", attendance: [{ sessionId: DEMO_SESSION.id, status: "rsvp" }] },
    { ...DEMO_MEMBERS[1], id: "other", attendance: [{ sessionId: "old-session", status: "checked-in" }] },
  ];
  assert.equal(discover(members, DEMO_VIEWER, options).matches.length, 0);
});

test("direct name and skill queries cannot bypass visibility", () => {
  for (const name of ["Private sentinel", "Draft sentinel", "Withdrawn sentinel"]) assert.equal(run(name).matches.length, 0);
  assert.ok(!JSON.stringify(run("Blender")).includes("SENTINEL"));
});

test("complementary needs rank a filmmaker highly for an AI-assisted film maker", () => {
  assert.equal(run().matches[0].member.id, "maya");
  assert.ok(run().matches.slice(0, 3).some(m => m.member.discipline !== "technology"));
});

test("grounded reasons cite exact candidate fields and never manufacture a skill", () => {
  for (const match of run().matches) {
    assert.ok(match.evidence.length > 0);
    const m = match.member;
    for (const e of match.evidence) {
      const values = e.field === "project" ? [m.project.title, m.project.summary, ...m.project.topics] : e.field === "practice" ? [m.practice] : m[e.field];
      assert.ok(values.includes(e.excerpt), `${m.id}: ${e.excerpt}`);
    }
    assert.ok(!match.reason.includes("expert"));
  }
});

test("known meetings are excluded from proactive recommendations but remain searchable", () => {
  assert.ok(!run("", { metIds: ["maya"] }).matches.some(m => m.member.id === "maya"));
  assert.equal(run("Maya", { metIds: ["maya"] }).matches[0].metBefore, true);
});

test("focus-only members are searchable with truthful presence but not proactively introduced", () => {
  assert.ok(!run().matches.some(m => m.member.id === "avery"));
  assert.equal(run("printmaking").matches[0].member.presence, "focusing");
});

const relevance: [string, string[], Record<string, unknown>?][] = [
  ["Who here knows Blender?", ["casey"]],
  ["Who's working on interesting hardware projects?", ["theo"]],
  ["Has anyone built an iOS app?", ["sam"], { scope: "community" }],
  ["Who should I talk to about making a music video?", ["maya", "jamie"]],
  ["Who here is interested in education and artificial intelligence?", ["sofia", "lina"]],
  ["Does anyone know motion design?", ["rowan"]],
  ["Who at USC is building something related to filmmaking?", ["jamie"]],
  ["Who was working on robotics last semester?", ["devon"], { scope: "community" }],
];
for (const [query, expected, extra] of relevance) test(`relevance: ${query}`, () => {
  const result = run(query, extra);
  assert.ok(result.matches.length > 0, query);
  assert.ok(expected.includes(result.matches[0].member.id), JSON.stringify(result.matches.map(m => m.member.id)));
});

test("capability questions don't turn a listed interest into experience", () => {
  const interested = { ...DEMO_MEMBERS[1], id: "interested", interests: ["Blender"], offers: [], project: { ...DEMO_MEMBERS[1].project, topics: [], summary: "An unrelated project." } };
  assert.equal(discover([interested], DEMO_VIEWER, { ...options, query: "Who knows Blender?" }).matches.length, 0);
});

test("a related technology is not evidence of a specifically requested tool", () => {
  const webMaker = { ...DEMO_MEMBERS[1], id: "web-maker", interests: [], offers: ["web development"], project: { ...DEMO_MEMBERS[1].project, topics: ["web development"], summary: "A website for our studio." } };
  assert.equal(discover([webMaker], DEMO_VIEWER, { ...options, query: "Who knows TypeScript?" }).matches.length, 0);
  assert.equal(discover([webMaker], DEMO_VIEWER, { ...options, query: "Who can help with React?" }).matches.length, 0);
});

test("AI-assisted projects and learning design do not establish machine-learning experience", () => {
  for (const query of ["Who has machine learning experience?", "Who is proficient in machine learning?"]) {
    assert.equal(run(query).matches.length, 0, query);
  }
});

test("specific capability phrases match explicit offers and project experience", () => {
  const base = DEMO_MEMBERS[1];
  const maker = { ...base, id: "ml-maker", offers: ["machine learning"], project: { ...base.project, topics: ["machine learning"], summary: "A machine learning model for birdsong." } };
  const result = discover([maker], DEMO_VIEWER, { ...options, query: "Who has machine learning experience?" });
  assert.equal(result.matches[0].member.id, "ml-maker");
  assert.ok(result.matches[0].evidence.some(e => /machine learning/i.test(e.excerpt)));
  assert.match(result.matches[0].starter, /machine learning/);
});

test("a current project has more introduction relevance than the same historical project", () => {
  const base = DEMO_MEMBERS.find(m => m.id === "maya")!;
  const old = { ...base, id: "a-historical", project: { ...base.project, period: "last-semester" as const } };
  const current = { ...base, id: "z-current" };
  assert.equal(discover([old, current], DEMO_VIEWER, options).matches[0].member.id, current.id);
});

test("requests for help require an explicit offer, not a need or an interest", () => {
  for (const query of ["Who can help with sound design?", "Who could help me with sound design?", "Looking for help with sound design"]) {
    assert.deepEqual(run(query).matches.map(m => m.member.id), ["jamie"], query);
  }
});

test("known concepts do not hide unsupported additional constraints", () => {
  assert.equal(run("Who knows Blender and Houdini?").matches.length, 0);
  assert.equal(run("Who is interested in education and quantum potatoes?").matches.length, 0);
});

test("different-practice requests preserve campus, topic and capability constraints", () => {
  assert.equal(run("Find someone different at USC who knows Blender").matches.length, 0);
  const result = run("Find someone different at UCLA who knows Blender");
  assert.deepEqual(result.matches.map(m => m.member.id), ["casey"]);
  assert.ok(run("Find someone working on something completely different from me").matches.length > 0);
});

test("search conversation starters refer to the matched evidence", () => {
  const match = run("Who here knows Blender?").matches[0];
  assert.match(match.starter, /Blender/);
  assert.ok(match.evidence.some(e => match.starter.includes(e.excerpt)));
});

test("unsupported and sensitive-trait queries fail closed without returning a people list", () => {
  for (const query of ["quantum potato accelerator", "find young women", "who is Muslim", "who has depression", "wealthy people", "Who is Black and knows Blender?"]) assert.equal(run(query).matches.length, 0, query);
});

test("surprise changes practice while retaining real evidence and rotates deterministically", () => {
  const a = run("", { mode: "surprise", seed: 0 });
  const b = run("", { mode: "surprise", seed: 1 });
  assert.ok(a.matches.length > 0);
  assert.ok(a.matches.every(m => m.differentPractice && m.evidence.length > 0));
  assert.notEqual(a.matches[0].member.id, b.matches[0].member.id);
  assert.deepEqual(a, run("", { mode: "surprise", seed: 0 }));
});

test("public DTO does not expose consent internals or attendance history", () => {
  const first = run().matches[0].member;
  for (const key of ["attendance", "visibility", "review", "openToMeet"]) assert.ok(!(key in first));
});
