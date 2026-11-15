/**
 * Uber groups for weeks with too few drivers. Riders walk to a campus meetup
 * spot and share one rideshare to the venue. Pure: no I/O, no Prisma, so it
 * runs under `npm test` like route.ts.
 */

import { haversineKm, type Pt } from "./route.ts";

export type Hub = {
  id: string;
  name: string;
  campus: string;
  /** Short directions for the member page and texts. */
  where: string;
  lat: number;
  lng: number;
};

/**
 * The meetup spots. Coordinates are from Mapbox; nudge them here if the pin
 * should sit somewhere more exact. Ids are stored on Car.hubId, so keep them.
 */
export const HUBS: Hub[] = [
  {
    id: "ucla",
    name: "De Neve turnaround",
    campus: "UCLA",
    where: "the turnaround on De Neve Dr, by De Neve Plaza",
    lat: 34.0707,
    lng: -118.4501,
  },
  {
    id: "usc",
    name: "USC Village",
    campus: "USC",
    where: "USC Village, on the Hoover St side",
    lat: 34.0255,
    lng: -118.2842,
  },
];

/** Straight-line km a rider can be from a hub and still be grouped automatically (roughly a 40-minute walk). */
export const MAX_WALK_KM = 3;
/** An UberX takes four; hosts can raise a group to six for an XL. */
export const UBER_SEATS = 4;
export const UBER_MAX_SEATS = 6;

export function hubById(id: string | null | undefined, hubs: Hub[] = HUBS): Hub | null {
  return hubs.find((h) => h.id === id) ?? null;
}

export function nearestHub(p: Pt, hubs: Hub[] = HUBS): { hub: Hub; km: number } | null {
  let best: { hub: Hub; km: number } | null = null;
  for (const hub of hubs) {
    const km = haversineKm(p, hub);
    if (!best || km < best.km) best = { hub, km };
  }
  return best;
}

/** Split n people into the fewest groups of at most `size`, as evenly as possible (5 → 3 + 2, not 4 + 1). */
export function evenSplit(n: number, size: number): number[] {
  if (n <= 0) return [];
  const k = Math.ceil(n / Math.max(1, size));
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

export type RideshareRider = { id: string; point: Pt };
export type ExistingGroup = { id: string; hubId: string; seatsTotal: number; riders: number };

export type RidesharePlan = {
  /** Riders added to groups that already exist. */
  fill: { groupId: string; riderId: string }[];
  /** New groups to create, one per entry. */
  create: { hubId: string; riderIds: string[] }[];
  /** Too far from every hub; a host places them by hand. */
  skipped: string[];
};

/**
 * Send each rider to their nearest hub (within maxWalkKm), top up open seats
 * in that hub's existing groups first, then split the rest into even groups.
 */
export function planRideshare(
  riders: RideshareRider[],
  existing: ExistingGroup[],
  opts: { hubs?: Hub[]; seats?: number; maxWalkKm?: number } = {}
): RidesharePlan {
  const hubs = opts.hubs ?? HUBS;
  const seats = opts.seats ?? UBER_SEATS;
  const maxWalkKm = opts.maxWalkKm ?? MAX_WALK_KM;

  const byHub = new Map<string, { id: string; km: number }[]>();
  const skipped: string[] = [];
  for (const r of riders) {
    const near = nearestHub(r.point, hubs);
    if (!near || near.km > maxWalkKm) {
      skipped.push(r.id);
      continue;
    }
    const list = byHub.get(near.hub.id) ?? [];
    list.push({ id: r.id, km: near.km });
    byHub.set(near.hub.id, list);
  }

  const fill: RidesharePlan["fill"] = [];
  const create: RidesharePlan["create"] = [];
  for (const hub of hubs) {
    const queue = (byHub.get(hub.id) ?? []).sort((a, b) => a.km - b.km).map((r) => r.id);
    for (const g of existing.filter((e) => e.hubId === hub.id)) {
      let open = g.seatsTotal - g.riders;
      while (open > 0 && queue.length > 0) {
        fill.push({ groupId: g.id, riderId: queue.shift()! });
        open -= 1;
      }
    }
    for (const size of evenSplit(queue.length, seats)) {
      create.push({ hubId: hub.id, riderIds: queue.splice(0, size) });
    }
  }
  return { fill, create, skipped };
}

/**
 * When to meet at the hub: the drive (straight line × 1.35 at ~30 km/h),
 * plus 15 minutes to get the car, floored to five minutes. 45 minutes early
 * when the venue has no location.
 */
export function defaultMeetAt(startAt: Date, hub: Pt, venue: Pt | null): Date {
  const minutes = venue ? Math.ceil((haversineKm(hub, venue) * 1.35 * 60) / 30) + 15 : 45;
  const t = startAt.getTime() - minutes * 60_000;
  const five = 5 * 60_000;
  return new Date(Math.floor(t / five) * five);
}

// ─── Wall-clock times in the event's timezone ────────────────────────────────

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** "13:10" for a Date, as the clock reads in `timeZone`. */
export function toWallTime(date: Date, timeZone = "America/Los_Angeles"): string {
  const p = zonedParts(date, timeZone);
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

/** The instant a clock in `timeZone` reads `hhmm` on the same local day as `day`. */
export function fromWallTime(day: Date, hhmm: string, timeZone = "America/Los_Angeles"): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  const d = zonedParts(day, timeZone);
  const guess = Date.UTC(d.y, d.mo - 1, d.d, h, mi);
  // Offset of the zone at that instant (local − UTC), then correct once more across DST edges.
  const offsetAt = (t: number) => {
    const p = zonedParts(new Date(t), timeZone);
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - t;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return new Date(t);
}
