/**
 * Pure carpool geometry: route length, cheapest insertion, and the greedy
 * matcher that places unassigned riders into cars. No I/O, no Prisma, so it
 * can be unit-tested with `npm test`.
 *
 * Distances are straight-line (haversine) kilometers. Good enough to order
 * stops and compare candidate cars across the USC / UCLA corridor; swap in
 * Mapbox Matrix drive-times later without changing any caller.
 */

export type Pt = { lat: number; lng: number };

export type CarInput = {
  id: string;
  start: Pt;
  seatsTotal: number;
  stops: { riderId: string; point: Pt }[];
};

export type RiderInput = { id: string; point: Pt };

export type Placement = {
  riderId: string;
  carId: string;
  index: number;
  addedKm: number;
};

export type SuggestOptions = {
  /** Never add a single rider if it lengthens the route by more than this. */
  maxAddedKm?: number;
  /** Never let a car's total detour (route − direct) exceed this. */
  maxDetourKm?: number;
};

const DEFAULTS: Required<SuggestOptions> = { maxAddedKm: 10, maxDetourKm: 20 };

export function haversineKm(a: Pt, b: Pt): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Length of start → stops (in order) → end. */
export function routeKm(start: Pt, stops: Pt[], end: Pt): number {
  let total = 0;
  let prev = start;
  for (const s of stops) {
    total += haversineKm(prev, s);
    prev = s;
  }
  return total + haversineKm(prev, end);
}

/** Cumulative km from the start to each stop, then to the end. */
export function legKm(start: Pt, stops: Pt[], end: Pt): number[] {
  const out: number[] = [];
  let total = 0;
  let prev = start;
  for (const s of stops) {
    total += haversineKm(prev, s);
    out.push(total);
    prev = s;
  }
  out.push(total + haversineKm(prev, end));
  return out;
}

/** Extra km if `candidate` is inserted before stops[index] (index may equal stops.length). */
export function insertionCost(
  start: Pt,
  stops: Pt[],
  end: Pt,
  candidate: Pt,
  index: number
): number {
  const before = index === 0 ? start : stops[index - 1];
  const after = index === stops.length ? end : stops[index];
  return (
    haversineKm(before, candidate) +
    haversineKm(candidate, after) -
    haversineKm(before, after)
  );
}

export function bestInsertion(
  start: Pt,
  stops: Pt[],
  end: Pt,
  candidate: Pt
): { index: number; addedKm: number } {
  let best = { index: 0, addedKm: Infinity };
  for (let i = 0; i <= stops.length; i++) {
    const addedKm = insertionCost(start, stops, end, candidate, i);
    if (addedKm < best.addedKm) best = { index: i, addedKm };
  }
  return best;
}

/**
 * Greedy global cheapest insertion. At each step, pick the (rider, car,
 * position) with the smallest added distance across every open seat, insert
 * it, repeat until no rider can be placed within the caps. Existing stops are
 * never moved, so host placements survive.
 */
export function suggestPlacements(
  cars: CarInput[],
  riders: RiderInput[],
  venue: Pt,
  options: SuggestOptions = {}
): { placements: Placement[]; unplaced: string[]; cars: CarInput[] } {
  const opts = { ...DEFAULTS, ...options };
  const work: CarInput[] = cars.map((c) => ({
    ...c,
    stops: c.stops.map((s) => ({ ...s })),
  }));
  const remaining = new Map(riders.map((r) => [r.id, r]));
  const placements: Placement[] = [];

  const direct = new Map(work.map((c) => [c.id, haversineKm(c.start, venue)]));

  // Straight-line insertion cost is nearly identical for any rider close to the
  // venue, whichever car you pick. Within this margin, prefer the car whose
  // driver starts nearest the rider so local drivers pick up local riders.
  const TIE_KM = 0.25;

  while (remaining.size > 0) {
    let best: Placement | null = null;
    let bestStartKm = Infinity;

    for (const car of work) {
      if (car.stops.length >= car.seatsTotal) continue;
      const points = car.stops.map((s) => s.point);
      const currentRoute = routeKm(car.start, points, venue);
      const currentDetour = currentRoute - (direct.get(car.id) ?? 0);

      for (const rider of remaining.values()) {
        const { index, addedKm } = bestInsertion(car.start, points, venue, rider.point);
        if (addedKm > opts.maxAddedKm) continue;
        if (currentDetour + addedKm > opts.maxDetourKm) continue;
        const startKm = haversineKm(car.start, rider.point);
        const clearlyBetter = !best || addedKm < best.addedKm - TIE_KM;
        const tieButCloser =
          best !== null && Math.abs(addedKm - best.addedKm) <= TIE_KM && startKm < bestStartKm;
        if (clearlyBetter || tieButCloser) {
          best = { riderId: rider.id, carId: car.id, index, addedKm };
          bestStartKm = startKm;
        }
      }
    }

    if (!best) break;

    const car = work.find((c) => c.id === best!.carId)!;
    const rider = remaining.get(best.riderId)!;
    car.stops.splice(best.index, 0, { riderId: rider.id, point: rider.point });
    remaining.delete(best.riderId);
    placements.push(best);
  }

  return { placements, unplaced: [...remaining.keys()], cars: work };
}

/** Reorder a car's existing stops to the shortest route by trying every permutation (n ≤ 7). */
export function optimizeOrder<T extends { point: Pt }>(start: Pt, stops: T[], end: Pt): T[] {
  if (stops.length <= 1) return stops.slice();
  if (stops.length > 7) return stops.slice(); // 5040 permutations is the sane ceiling

  let best = stops.slice();
  let bestKm = routeKm(start, best.map((s) => s.point), end);

  const permute = (arr: T[], k: number) => {
    if (k === arr.length) {
      const km = routeKm(start, arr.map((s) => s.point), end);
      if (km < bestKm) {
        bestKm = km;
        best = arr.slice();
      }
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      permute(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  permute(stops.slice(), 0);
  return best;
}
