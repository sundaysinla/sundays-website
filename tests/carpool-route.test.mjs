import assert from "node:assert/strict";
import test from "node:test";

import {
  haversineKm,
  routeKm,
  insertionCost,
  bestInsertion,
  suggestPlacements,
  optimizeOrder,
} from "../lib/carpool/route.ts";

// Real places along the corridor the matcher has to handle.
const WATT_HALL = { lat: 34.0191, lng: -118.288 }; // USC venue
const USC_VILLAGE = { lat: 34.0253, lng: -118.2851 };
const UNIVERSITY_PARK = { lat: 34.0303, lng: -118.2861 };
const KOREATOWN = { lat: 34.0619, lng: -118.3009 };
const WESTWOOD = { lat: 34.0633, lng: -118.4456 }; // UCLA
const SANTA_MONICA = { lat: 34.0195, lng: -118.4912 };
const PASADENA = { lat: 34.1478, lng: -118.1445 };
const CULVER_CITY = { lat: 34.0211, lng: -118.3965 };

test("haversine: UCLA to USC is roughly 15 km straight-line", () => {
  const km = haversineKm(WESTWOOD, WATT_HALL);
  assert.ok(km > 14 && km < 16, `got ${km}`);
});

test("routeKm with no stops equals the direct distance", () => {
  assert.equal(routeKm(WESTWOOD, [], WATT_HALL), haversineKm(WESTWOOD, WATT_HALL));
});

test("insertionCost is zero-ish for a stop already on the line", () => {
  // Culver City sits almost on the Westwood → USC line.
  const cost = insertionCost(WESTWOOD, [], WATT_HALL, CULVER_CITY, 0);
  assert.ok(cost < 3, `expected small detour, got ${cost}`);
});

test("bestInsertion picks the position that adds the least", () => {
  // Driver in Santa Monica, already stopping in Westwood, venue at USC.
  // Culver City belongs between Westwood and USC, not before Westwood.
  const { index } = bestInsertion(SANTA_MONICA, [WESTWOOD], WATT_HALL, CULVER_CITY);
  assert.equal(index, 1);
});

test("suggestPlacements fills the closest car and leaves far riders unplaced", () => {
  const cars = [
    { id: "westside", start: WESTWOOD, seatsTotal: 2, stops: [] },
    { id: "local", start: USC_VILLAGE, seatsTotal: 1, stops: [] },
  ];
  const riders = [
    { id: "r-culver", point: CULVER_CITY },
    { id: "r-univpark", point: UNIVERSITY_PARK },
    { id: "r-pasadena", point: PASADENA },
  ];
  const { placements, unplaced, cars: out } = suggestPlacements(cars, riders, WATT_HALL);

  const byRider = Object.fromEntries(placements.map((p) => [p.riderId, p.carId]));
  assert.equal(byRider["r-culver"], "westside");
  assert.equal(byRider["r-univpark"], "local");
  assert.deepEqual(unplaced, ["r-pasadena"]); // 12+ km off any route

  const west = out.find((c) => c.id === "westside");
  assert.equal(west.stops.length, 1);
  const local = out.find((c) => c.id === "local");
  assert.equal(local.stops.length, 1);
});

test("suggestPlacements respects seats", () => {
  const cars = [{ id: "c", start: WESTWOOD, seatsTotal: 1, stops: [] }];
  const riders = [
    { id: "a", point: CULVER_CITY },
    { id: "b", point: { lat: 34.03, lng: -118.41 } },
  ];
  const { placements, unplaced } = suggestPlacements(cars, riders, WATT_HALL);
  assert.equal(placements.length, 1);
  assert.equal(unplaced.length, 1);
});

test("suggestPlacements never moves existing stops", () => {
  const cars = [
    {
      id: "c",
      start: WESTWOOD,
      seatsTotal: 3,
      stops: [{ riderId: "pinned", point: KOREATOWN }],
    },
  ];
  const riders = [{ id: "new", point: CULVER_CITY }];
  const { cars: out } = suggestPlacements(cars, riders, WATT_HALL);
  const ids = out[0].stops.map((s) => s.riderId);
  assert.ok(ids.includes("pinned"));
  assert.ok(ids.includes("new"));
  // Culver City is on the way from Westwood, so it comes before the Koreatown hook.
  assert.deepEqual(ids, ["new", "pinned"]);
});

test("optimizeOrder finds the shortest order for a small set", () => {
  const stops = [
    { id: "kt", point: KOREATOWN },
    { id: "cc", point: CULVER_CITY },
    { id: "up", point: UNIVERSITY_PARK },
  ];
  const ordered = optimizeOrder(WESTWOOD, stops, WATT_HALL).map((s) => s.id);
  // From Westwood: Culver City, then Koreatown, then University Park, then USC.
  assert.deepEqual(ordered, ["cc", "kt", "up"]);
});
