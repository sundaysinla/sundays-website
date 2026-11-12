import test from "node:test";
import assert from "node:assert/strict";
import { matchPeople, type Person } from "../../lib/community/pilot/matching.ts";

const maya: Person = { id: "maya", card: { name: "Maya", project: "I’m editing a short documentary about public libraries.", portfolio: null } };
const eli: Person = { id: "eli", card: {
  name: "Eli", project: "Making music from field recordings.",
  portfolio: { url: "https://eli.example.com/", excerpts: [{
    url: "https://eli.example.com/work", text: "I write original scores for short films.",
  }] },
} };
const casey: Person = { id: "casey", card: { name: "Casey", project: "Building a website for a matcha pop-up.", portfolio: null } };

test("a submitted portfolio can establish a specific match the RSVP answer alone misses", () => {
  const { matches, people } = matchPeople([eli, casey], maya.card, "");
  assert.deepEqual(people.map(p => p.id), ["casey", "eli"]);
  assert.equal(matches[0]?.person.id, "eli");
  assert.equal(matches[0]?.topic, "short films");
  assert.equal(matches[0]?.theirs.url, "https://eli.example.com/work");
  assert.equal(matches[0]?.yours.text, maya.card.project);
  assert.deepEqual(matchPeople([{ ...eli, card: { ...eli.card, portfolio: null } }], maya.card, "").matches, []);
});

test("specific overlap in RSVP answers works without a website", () => {
  const jin: Person = { id: "jin", card: { name: "Jin", project: "Building a set for a short film.", portfolio: null } };
  assert.deepEqual(matchPeople([jin, casey], maya.card, "").matches.map(match => match.person.id), ["jin"]);
});

test("general buzzwords leave people discoverable without manufacturing a recommendation", () => {
  const viewer = { ...maya.card, project: "Making an AI project." };
  const other = { ...eli, card: { name: "Eli", project: "Building an AI demo.", portfolio: null } };
  const { matches, people } = matchPeople([other], viewer, "");
  assert.deepEqual(matches, []);
  assert.deepEqual(people, [other]);
});

test("ends of adjacent sentences do not become shared project phrases", () => {
  const viewer = { ...maya.card, project: "Directing a short film. Demo coming next week." };
  const other = { ...eli, card: { name: "Eli", project: "Working on a film demo about radiology.", portfolio: null } };
  assert.deepEqual(matchPeople([other], viewer, "").matches, []);
});

test("an iOS match requires an explicit mention rather than an ambiguous technology alias", () => {
  const viewer = { ...maya.card, project: "Building an iOS music app." };
  const profiles = [
    { ...eli, card: { name: "Eli", project: "Making swift sketches of migratory birds.", portfolio: null } },
    { ...casey, card: { name: "Casey", project: "Working on mobile development for Android.", portfolio: null } },
    { id: "jin", card: { name: "Jin", project: "Designing icons for iOS.", portfolio: null } },
  ];
  assert.deepEqual(matchPeople(profiles, viewer, "").matches.map(match => match.person.id), ["jin"]);
});

test("people can browse without a profile and search by name or approved project evidence", () => {
  assert.deepEqual(matchPeople([eli, casey], null, "field recordings").people.map(person => person.id), ["eli"]);
  assert.deepEqual(matchPeople([eli, casey], null, "Casey").people.map(person => person.id), ["casey"]);
  assert.deepEqual(matchPeople([eli, casey], null, "public libraries").people, []);
});
