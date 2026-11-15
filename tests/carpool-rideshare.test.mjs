import assert from "node:assert/strict";
import test from "node:test";

import {
  HUBS,
  defaultMeetAt,
  evenSplit,
  fromWallTime,
  nearestHub,
  planRideshare,
  toWallTime,
} from "../lib/carpool/rideshare.ts";

const WATT_HALL = { lat: 34.0191, lng: -118.288 };
const MID_CITY = { lat: 34.0469, lng: -118.3571 };
// Around each campus.
const HEDRICK = { lat: 34.0732, lng: -118.4522 }; // UCLA Hill
const WESTWOOD_VILLAGE = { lat: 34.0617, lng: -118.4467 };
const LEVERING = { lat: 34.0665, lng: -118.4545 };
const STRATHMORE = { lat: 34.068, lng: -118.45 };
const SAWTELLE = { lat: 34.0402, lng: -118.4439 }; // ~3.4 km from De Neve: too far to walk
const UNIVERSITY_PARK = { lat: 34.0303, lng: -118.2861 };
const FIGUEROA = { lat: 34.0262, lng: -118.2779 };
const PASADENA = { lat: 34.1478, lng: -118.1445 };

test("nearestHub picks the right campus", () => {
  assert.equal(nearestHub(HEDRICK).hub.id, "ucla");
  assert.equal(nearestHub(UNIVERSITY_PARK).hub.id, "usc");
  assert.ok(nearestHub(HEDRICK).km < 1);
});

test("evenSplit prefers balanced groups", () => {
  assert.deepEqual(evenSplit(0, 4), []);
  assert.deepEqual(evenSplit(3, 4), [3]);
  assert.deepEqual(evenSplit(4, 4), [4]);
  assert.deepEqual(evenSplit(5, 4), [3, 2]);
  assert.deepEqual(evenSplit(9, 4), [3, 3, 3]);
  assert.deepEqual(evenSplit(10, 4), [4, 3, 3]);
});

test("planRideshare groups by hub and skips people too far from both", () => {
  const riders = [
    { id: "hedrick", point: HEDRICK },
    { id: "village", point: WESTWOOD_VILLAGE },
    { id: "levering", point: LEVERING },
    { id: "strathmore", point: STRATHMORE },
    { id: "sawtelle", point: SAWTELLE },
    { id: "upark", point: UNIVERSITY_PARK },
    { id: "pasadena", point: PASADENA },
  ];
  const plan = planRideshare(riders, []);
  assert.deepEqual(plan.skipped, ["sawtelle", "pasadena"]);
  assert.equal(plan.fill.length, 0);
  const ucla = plan.create.filter((g) => g.hubId === "ucla");
  const usc = plan.create.filter((g) => g.hubId === "usc");
  assert.equal(ucla.length, 1);
  assert.deepEqual(ucla[0].riderIds.slice().sort(), ["hedrick", "levering", "strathmore", "village"]);
  assert.deepEqual(usc, [{ hubId: "usc", riderIds: ["upark"] }]);
});

test("planRideshare tops up existing groups before opening new ones", () => {
  const riders = [
    { id: "a", point: UNIVERSITY_PARK },
    { id: "b", point: FIGUEROA },
    { id: "c", point: UNIVERSITY_PARK },
  ];
  const plan = planRideshare(riders, [{ id: "g1", hubId: "usc", seatsTotal: 4, riders: 2 }]);
  assert.equal(plan.fill.length, 2);
  assert.ok(plan.fill.every((f) => f.groupId === "g1"));
  assert.equal(plan.create.length, 1);
  assert.equal(plan.create[0].riderIds.length, 1);
});

test("planRideshare splits five riders at one hub into 3 + 2", () => {
  const riders = ["a", "b", "c", "d", "e"].map((id) => ({ id, point: HEDRICK }));
  const plan = planRideshare(riders, []);
  assert.deepEqual(plan.create.map((g) => g.riderIds.length), [3, 2]);
});

test("defaultMeetAt leaves time for the drive and the pickup, on a five-minute mark", () => {
  const start = new Date("2026-09-27T21:00:00Z"); // 2:00 PM PDT
  const ucla = HUBS.find((h) => h.id === "ucla");
  const meet = defaultMeetAt(start, ucla, MID_CITY);
  const minutesBefore = (start.getTime() - meet.getTime()) / 60_000;
  assert.ok(minutesBefore >= 30 && minutesBefore <= 60, `got ${minutesBefore}`);
  assert.equal(meet.getUTCMinutes() % 5, 0);
  // Close to the venue means leaving later.
  const usc = HUBS.find((h) => h.id === "usc");
  assert.ok(defaultMeetAt(start, usc, WATT_HALL) > meet);
  // No venue location: 45 minutes early.
  assert.equal(defaultMeetAt(start, ucla, null).toISOString(), "2026-09-27T20:15:00.000Z");
});

test("wall times round-trip in Los Angeles, including across DST", () => {
  const sunday = new Date("2026-09-27T21:00:00Z");
  assert.equal(toWallTime(sunday), "14:00");
  assert.equal(fromWallTime(sunday, "13:15").toISOString(), "2026-09-27T20:15:00.000Z");
  const winter = new Date("2026-12-06T22:00:00Z"); // 2:00 PM PST
  assert.equal(toWallTime(winter), "14:00");
  assert.equal(fromWallTime(winter, "13:15").toISOString(), "2026-12-06T21:15:00.000Z");
  assert.equal(fromWallTime(sunday, "25:00"), null);
  assert.equal(fromWallTime(sunday, "noon"), null);
});
