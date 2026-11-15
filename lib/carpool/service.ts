/**
 * Carpool mutations. Every write to Car / CarStop / CarpoolOffer goes through
 * here so route metrics, seat limits, and "changed since confirmed" stay
 * consistent. Server actions in lib/actions/* are thin wrappers that add auth.
 */

import { prisma } from "@/lib/db";
import { geocodeAddress, reverseGeocode } from "@/lib/geo";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { normalizePhone } from "@/lib/phone";
import { createNotification } from "@/lib/notifications";
import {
  bestInsertion,
  haversineKm,
  optimizeOrder,
  routeKm,
  suggestPlacements,
  type Pt,
} from "@/lib/carpool/route";
import {
  defaultMeetAt,
  hubById,
  planRideshare,
  UBER_MAX_SEATS,
  UBER_SEATS,
} from "@/lib/carpool/rideshare";
import type { CarKind, CarpoolRole, CarStopSource } from "@prisma/client";

export type Venue = Pt;

const offerWithUser = {
  user: { include: { profile: true } },
} as const;

type OfferRow = {
  id: string;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone?: string | null;
  role: CarpoolRole;
  lat: number;
  lng: number;
  user: {
    name: string | null;
    email: string | null;
    profile: { displayName: string | null; contactEmail: string; phone?: string | null } | null;
  } | null;
};

export function offerPhone(o: OfferRow): string | null {
  return o.user?.profile?.phone || o.guestPhone || null;
}

function portalUrl(path: string) {
  return `${process.env.AUTH_URL || "http://localhost:4000"}${path}`;
}

export function offerName(o: OfferRow): string {
  return (
    o.user?.profile?.displayName?.trim() ||
    o.user?.name?.trim() ||
    o.guestName?.trim() ||
    o.user?.profile?.contactEmail ||
    o.user?.email ||
    o.guestEmail ||
    "Member"
  );
}

export function offerEmail(o: OfferRow): string | null {
  return o.user?.profile?.contactEmail || o.user?.email || o.guestEmail || null;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export async function getVenue(lumaEventId: string): Promise<Venue | null> {
  const event = await prisma.eventCache.findUnique({ where: { lumaEventId } });
  if (!event) return null;
  if (event.lat != null && event.lng != null) return { lat: event.lat, lng: event.lng };
  if (!event.address) return null;
  try {
    const geo = await geocodeAddress(event.address);
    await prisma.eventCache.update({
      where: { lumaEventId },
      data: { lat: geo.lat, lng: geo.lng },
    });
    return { lat: geo.lat, lng: geo.lng };
  } catch {
    return null;
  }
}

/**
 * Notify whoever is behind an offer. Members get an in-app notification plus
 * email; guests get email. Anyone with a phone number also gets a text.
 */
export async function notifyOffer(
  offer: OfferRow,
  params: { type: string; title: string; body: string; emailSubject: string; sms?: string }
) {
  if (offer.userId) {
    await createNotification({
      userId: offer.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      href: "/portal/carpool",
      emailSubject: params.emailSubject,
    });
  } else if (offer.guestEmail) {
    try {
      await sendEmail({ to: offer.guestEmail, subject: params.emailSubject, html: `<p>${params.body}</p>` });
    } catch (e) {
      console.warn("[carpool] guest email failed", e);
    }
  }

  const phone = offerPhone(offer);
  if (phone && params.sms) {
    try {
      const tail = offer.userId ? ` ${portalUrl("/portal/carpool")}` : "";
      await sendSms(phone, `${params.sms}${tail}`);
    } catch (e) {
      console.warn("[carpool] sms failed", e);
    }
  }
}

// ─── Cars ────────────────────────────────────────────────────────────────────
//
// A car is either driven by a member (kind "drive": the route starts at the
// driver and picks riders up where they are) or a shared Uber (kind
// "rideshare": riders walk to a campus hub and the route starts there).

type CarShape = {
  kind: CarKind;
  hubId: string | null;
  driverOffer: (OfferRow & { lat: number; lng: number }) | null;
};

/** Where the car's route begins: the driver's start, or the Uber's meetup spot. */
export function carStart(car: { kind: CarKind; hubId: string | null; driverOffer: { lat: number; lng: number } | null }): Pt | null {
  if (car.kind === "rideshare") {
    const hub = hubById(car.hubId);
    return hub ? { lat: hub.lat, lng: hub.lng } : null;
  }
  return car.driverOffer ? { lat: car.driverOffer.lat, lng: car.driverOffer.lng } : null;
}

/** "Maya's car" or "the De Neve turnaround Uber", for sentences. */
export function carLabel(car: CarShape): string {
  if (car.kind === "rideshare") return `the ${hubById(car.hubId)?.name ?? "shared"} Uber`;
  return car.driverOffer ? `${firstName(offerName(car.driverOffer))}'s car` : "a car";
}

export async function ensureCarForOffer(offerId: string, venue: Venue | null) {
  const offer = await prisma.carpoolOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.role !== "driver") throw new Error("Not a driver offer");
  const seatsTotal = Math.max(1, offer.seatsTotal ?? 1);
  const direct = venue ? haversineKm(offer, venue) : 0;

  const car = await prisma.car.upsert({
    where: { driverOfferId: offer.id },
    create: {
      lumaEventId: offer.lumaEventId,
      driverOfferId: offer.id,
      seatsTotal,
      directKm: direct,
      routeKm: direct,
    },
    update: { seatsTotal },
  });
  await recomputeCar(car.id, venue);
  return car;
}

/** Every open driver offer must own a Car; create any that are missing (e.g. after a schema migration). */
export async function ensureCarsForEvent(lumaEventId: string, venue: Venue | null) {
  const orphans = await prisma.carpoolOffer.findMany({
    where: { lumaEventId, role: "driver", status: "open", car: null },
    select: { id: true },
  });
  for (const o of orphans) await ensureCarForOffer(o.id, venue);
  return orphans.length;
}

export async function recomputeCar(carId: string, venue: Venue | null) {
  const car = await prisma.car.findUnique({
    where: { id: carId },
    include: { driverOffer: true, stops: { include: { riderOffer: true }, orderBy: { order: "asc" } } },
  });
  if (!car) return null;
  const start = carStart(car);
  // Uber riders walk to the hub, so their homes aren't on the route.
  const points = car.kind === "rideshare" ? [] : car.stops.map((s) => ({ lat: s.riderOffer.lat, lng: s.riderOffer.lng }));
  const directKm = venue && start ? haversineKm(start, venue) : 0;
  const route = venue && start ? routeKm(start, points, venue) : 0;

  // Renumber defensively so `order` is always 0..n-1.
  for (let i = 0; i < car.stops.length; i++) {
    if (car.stops[i].order !== i) {
      await prisma.carStop.update({ where: { id: car.stops[i].id }, data: { order: i } });
    }
  }

  return prisma.car.update({
    where: { id: carId },
    data: { directKm, routeKm: route },
  });
}

/** Mark a confirmed car as edited so the host sees "confirm changes". */
async function touchCar(carId: string) {
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (car?.confirmedAt) {
    await prisma.car.update({ where: { id: carId }, data: { changedAt: new Date() } });
  }
}

// ─── Stops ───────────────────────────────────────────────────────────────────

export async function placeRider(params: {
  riderOfferId: string;
  carId: string;
  index?: number;
  source: CarStopSource;
  venue: Venue | null;
}) {
  const [rider, car] = await Promise.all([
    prisma.carpoolOffer.findUnique({ where: { id: params.riderOfferId }, include: offerWithUser }),
    prisma.car.findUnique({
      where: { id: params.carId },
      include: {
        driverOffer: { include: offerWithUser },
        stops: { include: { riderOffer: true }, orderBy: { order: "asc" } },
      },
    }),
  ]);
  if (!rider || rider.role !== "rider" || rider.status === "withdrawn") {
    throw new Error("That rider isn't on this week's board");
  }
  if (!car) throw new Error("That car no longer exists");
  if (car.lumaEventId !== rider.lumaEventId) throw new Error("Rider and car are for different events");

  const existing = await prisma.carStop.findUnique({ where: { riderOfferId: rider.id } });
  const alreadyHere = existing?.carId === car.id;
  const occupied = car.stops.filter((s) => s.riderOfferId !== rider.id).length;
  if (occupied >= car.seatsTotal) {
    const name = carLabel(car);
    throw new Error(`${name.charAt(0).toUpperCase()}${name.slice(1)} is full`);
  }

  if (existing && !alreadyHere) {
    await prisma.carStop.delete({ where: { id: existing.id } });
    await recomputeCar(existing.carId, params.venue);
    await touchCar(existing.carId);
  }

  const others = car.stops.filter((s) => s.riderOfferId !== rider.id);
  const start = carStart(car);
  const points = others.map((s) => ({ lat: s.riderOffer.lat, lng: s.riderOffer.lng }));
  let index = params.index;
  let addedKm = 0;
  if (params.venue && start && car.kind === "drive") {
    const best = bestInsertion(start, points, params.venue, { lat: rider.lat, lng: rider.lng });
    if (index == null) index = best.index;
    addedKm = best.addedKm;
  }
  index = Math.max(0, Math.min(others.length, index ?? others.length));

  // Shift the stops after the insertion point.
  for (let i = others.length - 1; i >= index; i--) {
    await prisma.carStop.update({ where: { id: others[i].id }, data: { order: i + 1 } });
  }

  const stop = alreadyHere
    ? await prisma.carStop.update({
        where: { id: existing!.id },
        data: { order: index, source: params.source, addedKm, confirmedAt: null },
      })
    : await prisma.carStop.create({
        data: {
          carId: car.id,
          riderOfferId: rider.id,
          order: index,
          source: params.source,
          addedKm,
        },
      });

  await recomputeCar(car.id, params.venue);
  await touchCar(car.id);
  return stop;
}

export async function unplaceRider(riderOfferId: string, venue: Venue | null, opts?: { notify?: boolean }) {
  const stop = await prisma.carStop.findUnique({
    where: { riderOfferId },
    include: {
      car: { include: { driverOffer: { include: offerWithUser } } },
      riderOffer: { include: offerWithUser },
    },
  });
  if (!stop) return null;
  await prisma.carStop.delete({ where: { id: stop.id } });
  if (stop.car.bookerOfferId === riderOfferId) {
    await prisma.car.update({ where: { id: stop.carId }, data: { bookerOfferId: null } });
  }
  await recomputeCar(stop.carId, venue);
  await touchCar(stop.carId);

  if (opts?.notify && stop.confirmedAt) {
    await notifyOffer(stop.riderOffer, {
      type: "carpool_removed",
      title: "Carpool changed",
      body: `A host took you out of ${carLabel(stop.car)} for this Sunday. Check Carpool for your current ride.`,
      emailSubject: "Sundays carpool — your ride changed",
    });
  }
  return stop;
}

export async function reorderCar(carId: string, stopIds: string[], venue: Venue | null) {
  const stops = await prisma.carStop.findMany({ where: { carId } });
  const known = new Set(stops.map((s) => s.id));
  const ordered = stopIds.filter((id) => known.has(id));
  if (ordered.length !== stops.length) throw new Error("Stop list is out of date — refresh and try again");
  for (let i = 0; i < ordered.length; i++) {
    await prisma.carStop.update({ where: { id: ordered[i] }, data: { order: i } });
  }
  await recomputeCar(carId, venue);
  await touchCar(carId);
}

export async function optimizeCar(carId: string, venue: Venue | null) {
  if (!venue) throw new Error("Venue location is missing");
  const car = await prisma.car.findUnique({
    where: { id: carId },
    include: { driverOffer: true, stops: { include: { riderOffer: true }, orderBy: { order: "asc" } } },
  });
  if (!car) throw new Error("Car not found");
  if (car.kind === "rideshare" || !car.driverOffer) throw new Error("Uber riders all meet at one spot — there's no order to optimize");
  const ordered = optimizeOrder(
    { lat: car.driverOffer.lat, lng: car.driverOffer.lng },
    car.stops.map((s) => ({ id: s.id, point: { lat: s.riderOffer.lat, lng: s.riderOffer.lng } })),
    venue
  );
  await reorderCar(carId, ordered.map((s) => s.id), venue);
}

export async function setCarSeats(carId: string, seatsTotal: number, venue: Venue | null) {
  const car = await prisma.car.findUnique({ where: { id: carId }, include: { stops: true } });
  if (!car) throw new Error("Car not found");
  const seats = Math.max(1, Math.min(car.kind === "rideshare" ? UBER_MAX_SEATS : 8, Math.floor(seatsTotal)));
  if (seats < car.stops.length) {
    throw new Error(`${car.stops.length} riders are already in this car — move someone out first`);
  }
  await prisma.car.update({ where: { id: carId }, data: { seatsTotal: seats } });
  if (car.driverOfferId) {
    await prisma.carpoolOffer.update({ where: { id: car.driverOfferId }, data: { seatsTotal: seats } });
  }
  await recomputeCar(carId, venue);
}

// ─── Matching ────────────────────────────────────────────────────────────────

/**
 * Host-triggered. Drops unconfirmed matcher suggestions (Uber groups included,
 * so a new driver can absorb those riders), then runs cheapest insertion for
 * every rider without a stop. Host placements and confirmed stops are never
 * touched. Riders left over can go into Ubers with uberTheRest().
 */
export async function suggestForEvent(lumaEventId: string) {
  const venue = await getVenue(lumaEventId);
  if (!venue) throw new Error("This week's venue has no location yet");

  await prisma.carStop.deleteMany({
    where: { car: { lumaEventId }, source: "matcher", confirmedAt: null },
  });
  await dropEmptyRideshares(lumaEventId);

  const [cars, riders] = await Promise.all([
    prisma.car.findMany({
      where: { lumaEventId, kind: "drive", driverOffer: { status: "open" } },
      include: { driverOffer: true, stops: { include: { riderOffer: true }, orderBy: { order: "asc" } } },
    }),
    prisma.carpoolOffer.findMany({
      where: { lumaEventId, role: "rider", status: "open", stop: null },
    }),
  ]);

  const result = suggestPlacements(
    cars.map((c) => ({
      id: c.id,
      start: { lat: c.driverOffer!.lat, lng: c.driverOffer!.lng },
      seatsTotal: c.seatsTotal,
      stops: c.stops.map((s) => ({
        riderId: s.riderOfferId,
        point: { lat: s.riderOffer.lat, lng: s.riderOffer.lng },
      })),
    })),
    riders.map((r) => ({ id: r.id, point: { lat: r.lat, lng: r.lng } })),
    venue
  );

  // Write the final ordering per car in one pass.
  for (const car of result.cars) {
    const before = cars.find((c) => c.id === car.id)!;
    const existingByRider = new Map(before.stops.map((s) => [s.riderOfferId, s]));
    for (let i = 0; i < car.stops.length; i++) {
      const riderId = car.stops[i].riderId;
      const existing = existingByRider.get(riderId);
      if (existing) {
        if (existing.order !== i) {
          await prisma.carStop.update({ where: { id: existing.id }, data: { order: i } });
        }
      } else {
        const placement = result.placements.find((p) => p.riderId === riderId);
        await prisma.carStop.create({
          data: {
            carId: car.id,
            riderOfferId: riderId,
            order: i,
            source: "matcher",
            addedKm: placement?.addedKm ?? 0,
          },
        });
      }
    }
    await recomputeCar(car.id, venue);
    if (result.placements.some((p) => p.carId === car.id)) await touchCar(car.id);
  }

  return { placed: result.placements.length, unplaced: result.unplaced.length };
}

// ─── Confirmation ────────────────────────────────────────────────────────────

/** Confirm a car (first time or after edits). One email per member, not per pair. */
export async function confirmCar(carId: string) {
  const car = await prisma.car.findUnique({
    where: { id: carId },
    include: {
      event: true,
      driverOffer: { include: offerWithUser },
      stops: { include: { riderOffer: { include: offerWithUser } }, orderBy: { order: "asc" } },
    },
  });
  if (!car) throw new Error("Car not found");

  if (car.kind === "rideshare") return confirmRideshare(car);
  if (!car.driverOffer) throw new Error("This car has no driver");

  const wasConfirmed = !!car.confirmedAt;
  const now = new Date();
  await prisma.car.update({ where: { id: carId }, data: { confirmedAt: now, changedAt: null } });
  await prisma.carStop.updateMany({ where: { carId }, data: { confirmedAt: now } });

  const driverName = firstName(offerName(car.driverOffer));
  const when = eventWhen(car.event);
  const subject = wasConfirmed
    ? "Sundays carpool — your ride changed"
    : "Sundays carpool — your ride is set";

  const riderList = car.stops
    .map((s, i) => `${i + 1}. ${offerName(s.riderOffer)} — ${s.riderOffer.address}`)
    .join("\n");

  await notifyOffer(car.driverOffer, {
    type: wasConfirmed ? "carpool_changed" : "carpool_confirmed",
    title: wasConfirmed ? "Your car changed" : "Your car is set",
    body: wasConfirmed
      ? `A host updated your car for ${when}. You now have ${car.stops.length} pickup${car.stops.length === 1 ? "" : "s"}. Stop order and addresses are in Carpool.`
      : `You're driving ${car.stops.length} ${car.stops.length === 1 ? "person" : "people"} to Sundays on ${when}. Stop order and pickup addresses are in Carpool.`,
    emailSubject: subject,
    sms: `Sundays carpool: ${wasConfirmed ? "your car changed for" : "you're driving"} ${when}.\n${riderList}`,
  });

  const driverPhone = offerPhone(car.driverOffer);
  for (const stop of car.stops) {
    await notifyOffer(stop.riderOffer, {
      type: wasConfirmed ? "carpool_changed" : "carpool_confirmed",
      title: wasConfirmed ? "Your ride changed" : "Your ride is set",
      body: wasConfirmed
        ? `A host updated your car for ${when}. You're stop ${stop.order + 1} of ${car.stops.length} in ${driverName}'s car. Details are in Carpool.`
        : `You're riding with ${driverName} to Sundays on ${when}, stop ${stop.order + 1} of ${car.stops.length}. Details are in Carpool.`,
      emailSubject: subject,
      sms: `Sundays carpool: ${wasConfirmed ? "your ride changed." : "your ride is set."} ${driverName} picks you up at ${stop.riderOffer.address} (stop ${stop.order + 1} of ${car.stops.length}) for ${when}.${driverPhone ? ` Driver: ${driverPhone}` : ""}`,
    });
  }
}

function eventWhen(event: { startAt: Date; timezone: string | null }) {
  return event.startAt.toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone || "America/Los_Angeles",
  });
}

function clock(d: Date, timeZone: string | null) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timeZone || "America/Los_Angeles" });
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

type RideshareForConfirm = {
  id: string;
  confirmedAt: Date | null;
  hubId: string | null;
  meetAt: Date | null;
  bookerOfferId: string | null;
  event: { startAt: Date; timezone: string | null; address: string | null; title: string };
  stops: { order: number; riderOffer: OfferRow & { address: string } }[];
};

/** Tell each Uber rider where and when to meet, who they're riding with, and who orders the car. */
async function confirmRideshare(car: RideshareForConfirm) {
  const hub = hubById(car.hubId);
  if (!hub) throw new Error("This Uber has no meetup spot — pick one first");
  if (car.stops.length === 0) throw new Error("No one is in this Uber yet");

  const wasConfirmed = !!car.confirmedAt;
  const now = new Date();
  await prisma.car.update({ where: { id: car.id }, data: { confirmedAt: now, changedAt: null } });
  await prisma.carStop.updateMany({ where: { carId: car.id }, data: { confirmedAt: now } });

  const tz = car.event.timezone;
  const when = eventWhen(car.event);
  const meet = car.meetAt ? clock(car.meetAt, tz) : null;
  const booker = car.stops.find((s) => s.riderOffer.id === car.bookerOfferId)?.riderOffer ?? null;
  const bookerFirst = booker ? firstName(offerName(booker)) : null;
  const bookerPhone = booker ? offerPhone(booker) : null;
  const to = car.event.address || car.event.title;
  const subject = wasConfirmed ? "Sundays carpool — your Uber changed" : "Sundays carpool — your Uber is set";

  for (const stop of car.stops) {
    const me = stop.riderOffer;
    const others = car.stops.filter((s) => s.riderOffer.id !== me.id).map((s) => firstName(offerName(s.riderOffer)));
    const withWhom = others.length ? ` with ${joinNames(others)}` : "";
    const meetLine = `Meet at ${hub.name} (${hub.where})${meet ? ` at ${meet}` : ""}.`;
    const isBooker = booker?.id === me.id;
    const orderLine = isBooker
      ? `You're ordering the Uber${car.stops.length > 4 ? " (get an XL)" : ""} to ${to}.`
      : bookerFirst
        ? `${bookerFirst} is ordering it.`
        : "A host is ordering it for you.";

    await notifyOffer(me, {
      type: wasConfirmed ? "carpool_changed" : "carpool_confirmed",
      title: wasConfirmed ? "Your Uber changed" : "Your Uber is set",
      body: `${wasConfirmed ? "A host updated your Uber." : `You're sharing an Uber to Sundays${withWhom} on ${when}.`} ${meetLine} ${orderLine} Details and a group chat are in Carpool.`,
      emailSubject: subject,
      sms: `Sundays carpool: ${wasConfirmed ? `your Uber for ${when} changed.` : `you're in a shared Uber${withWhom} for ${when}.`} ${meetLine} ${orderLine}${!isBooker && bookerPhone ? ` ${bookerFirst}: ${bookerPhone}` : ""}`,
    });
  }
}

// ─── Uber groups ─────────────────────────────────────────────────────────────

export async function createRideshare(params: {
  lumaEventId: string;
  hubId: string;
  venue: Venue | null;
  seatsTotal?: number;
}) {
  const hub = hubById(params.hubId);
  if (!hub) throw new Error("Unknown meetup spot");
  const event = await prisma.eventCache.findUnique({ where: { lumaEventId: params.lumaEventId } });
  if (!event) throw new Error("That event isn't cached");
  const direct = params.venue ? haversineKm(hub, params.venue) : 0;
  return prisma.car.create({
    data: {
      lumaEventId: params.lumaEventId,
      kind: "rideshare",
      hubId: hub.id,
      meetAt: defaultMeetAt(event.startAt, hub, params.venue),
      seatsTotal: params.seatsTotal ?? UBER_SEATS,
      directKm: direct,
      routeKm: direct,
    },
  });
}

/** Empty, unsent Uber groups with no chat are clutter after a re-suggest; drop them. */
async function dropEmptyRideshares(lumaEventId: string) {
  await prisma.car.deleteMany({
    where: { lumaEventId, kind: "rideshare", confirmedAt: null, stops: { none: {} }, messages: { none: {} } },
  });
}

/**
 * Put every rider still without a ride into an Uber from their nearest hub:
 * top up open seats in existing groups at that hub, then open even-sized new
 * groups. Riders more than a walk from both hubs stay unassigned.
 */
export async function uberTheRest(lumaEventId: string) {
  const venue = await getVenue(lumaEventId);
  const [riders, groups] = await Promise.all([
    prisma.carpoolOffer.findMany({
      where: { lumaEventId, role: "rider", status: "open", stop: null },
      include: offerWithUser,
      orderBy: { createdAt: "asc" },
    }),
    prisma.car.findMany({
      where: { lumaEventId, kind: "rideshare" },
      include: { _count: { select: { stops: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (riders.length === 0) return { placed: 0, groups: 0, skipped: [] as string[] };

  const plan = planRideshare(
    riders.map((r) => ({ id: r.id, point: { lat: r.lat, lng: r.lng } })),
    groups.filter((g) => g.hubId).map((g) => ({ id: g.id, hubId: g.hubId!, seatsTotal: g.seatsTotal, riders: g._count.stops }))
  );

  const touched = new Set<string>();
  const append = async (carId: string, riderOfferId: string) => {
    const order = await prisma.carStop.count({ where: { carId } });
    await prisma.carStop.create({ data: { carId, riderOfferId, order, source: "matcher" } });
    touched.add(carId);
  };
  for (const f of plan.fill) await append(f.groupId, f.riderId);
  for (const g of plan.create) {
    const car = await createRideshare({ lumaEventId, hubId: g.hubId, venue });
    for (const id of g.riderIds) await append(car.id, id);
  }
  for (const id of touched) {
    await recomputeCar(id, venue);
    await touchCar(id);
  }

  const byId = new Map(riders.map((r) => [r.id, r]));
  return {
    placed: plan.fill.length + plan.create.reduce((n, g) => n + g.riderIds.length, 0),
    groups: plan.create.length,
    skipped: plan.skipped.map((id) => firstName(offerName(byId.get(id)!))),
  };
}

/** Change an Uber's meetup spot, meet time, or who orders it. */
export async function updateRideshare(
  carId: string,
  changes: { hubId?: string; meetAt?: Date; bookerOfferId?: string | null },
  venue: Venue | null
) {
  const car = await prisma.car.findUnique({ where: { id: carId }, include: { stops: true, event: true } });
  if (!car || car.kind !== "rideshare") throw new Error("That Uber no longer exists");

  const data: { hubId?: string; meetAt?: Date; bookerOfferId?: string | null } = {};
  if (changes.hubId !== undefined && changes.hubId !== car.hubId) {
    const hub = hubById(changes.hubId);
    if (!hub) throw new Error("Unknown meetup spot");
    data.hubId = hub.id;
    // Moving campuses changes the drive; keep a host-set time only if they're setting one now.
    if (changes.meetAt === undefined) data.meetAt = defaultMeetAt(car.event.startAt, hub, venue);
  }
  if (changes.meetAt !== undefined) {
    if (changes.meetAt.getTime() > car.event.startAt.getTime()) throw new Error("Meet time is after the event starts");
    data.meetAt = changes.meetAt;
  }
  if (changes.bookerOfferId !== undefined) {
    if (changes.bookerOfferId && !car.stops.some((s) => s.riderOfferId === changes.bookerOfferId)) {
      throw new Error("Whoever orders has to be in this Uber");
    }
    data.bookerOfferId = changes.bookerOfferId;
  }
  if (Object.keys(data).length === 0) return car;

  const updated = await prisma.car.update({ where: { id: carId }, data });
  if (data.hubId) await recomputeCar(carId, venue);
  await touchCar(carId);
  return updated;
}

/** Cancel an Uber group. Its riders go back to needing a ride. */
export async function removeRideshare(carId: string, opts?: { notify?: boolean }) {
  const car = await prisma.car.findUnique({
    where: { id: carId },
    include: { stops: { include: { riderOffer: { include: offerWithUser } } } },
  });
  if (!car || car.kind !== "rideshare") throw new Error("That Uber no longer exists");
  if (opts?.notify && car.confirmedAt) {
    for (const s of car.stops) {
      if (!s.confirmedAt) continue;
      await notifyOffer(s.riderOffer, {
        type: "carpool_removed",
        title: "Your Uber was called off",
        body: `Hosts cancelled ${carLabel({ ...car, driverOffer: null })} for this Sunday. They'll find you another ride — check Carpool.`,
        emailSubject: "Sundays carpool — your ride changed",
        sms: `Sundays carpool: the Uber from ${hubById(car.hubId)?.name ?? "campus"} is off. Hosts will find you another ride.`,
      });
    }
  }
  await prisma.car.delete({ where: { id: carId } });
}

// ─── Offers ──────────────────────────────────────────────────────────────────

export async function writeInPerson(params: {
  lumaEventId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: CarpoolRole;
  address?: string | null;
  /** Already-geocoded location (e.g. from a spreadsheet preview); skips geocoding. */
  geo?: { lat: number; lng: number; placeName: string; neighborhood: string | null } | null;
  seatsTotal?: number | null;
  notes?: string | null;
  carId?: string | null;
  venue: Venue | null;
  venueAddress?: string | null;
}) {
  const name = params.name.trim();
  if (!name) throw new Error("Name is required");
  const email = params.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email, or leave it blank");
  }
  const phone = params.phone?.trim() ? normalizePhone(params.phone) : null;
  if (params.phone?.trim() && !phone) {
    throw new Error("That phone number doesn't look right — use 10 digits, or +country code");
  }

  // Location: geocode what the host typed; fall back to the venue so the pin can be dragged.
  let geo: { lat: number; lng: number; placeName: string; neighborhood: string | null };
  const query = params.address?.trim();
  if (params.geo) {
    geo = params.geo;
  } else if (query) {
    try {
      geo = await geocodeAddress(query);
    } catch {
      if (!params.venue) throw new Error("Couldn't find that address and the venue has no location");
      geo = { ...params.venue, placeName: query, neighborhood: null };
    }
  } else {
    if (!params.venue) throw new Error("Enter an address — the venue has no location to fall back on");
    geo = { ...params.venue, placeName: params.venueAddress || "Near the venue", neighborhood: null };
  }

  const seatsTotal = params.role === "driver" ? Math.max(1, Math.min(8, params.seatsTotal || 3)) : null;
  const notes = params.notes?.trim() || null;

  // A known member? Attach the offer to their account instead of a guest row.
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  let offer;
  if (user) {
    const existing = await prisma.carpoolOffer.findUnique({
      where: { userId_lumaEventId: { userId: user.id, lumaEventId: params.lumaEventId } },
    });
    if (existing && existing.status === "open") throw new Error(`${name} is already on this week's board`);
    offer = await prisma.carpoolOffer.upsert({
      where: { userId_lumaEventId: { userId: user.id, lumaEventId: params.lumaEventId } },
      create: {
        userId: user.id,
        lumaEventId: params.lumaEventId,
        role: params.role,
        address: geo.placeName,
        lat: geo.lat,
        lng: geo.lng,
        neighborhood: geo.neighborhood,
        seatsTotal,
        notes,
      },
      update: {
        role: params.role,
        address: geo.placeName,
        lat: geo.lat,
        lng: geo.lng,
        neighborhood: geo.neighborhood,
        seatsTotal,
        notes,
        status: "open",
      },
    });
    if (phone) {
      await prisma.profile.updateMany({ where: { userId: user.id, phone: null }, data: { phone } });
    }
  } else {
    if (email) {
      const dup = await prisma.carpoolOffer.findFirst({
        where: { lumaEventId: params.lumaEventId, guestEmail: email, status: "open" },
      });
      if (dup) throw new Error(`${name} is already on this week's board`);
    }
    offer = await prisma.carpoolOffer.create({
      data: {
        guestName: name,
        guestEmail: email,
        guestPhone: phone,
        lumaEventId: params.lumaEventId,
        role: params.role,
        address: geo.placeName,
        lat: geo.lat,
        lng: geo.lng,
        neighborhood: geo.neighborhood,
        seatsTotal,
        notes,
      },
    });
  }

  if (params.role === "driver") {
    await ensureCarForOffer(offer.id, params.venue);
  } else if (params.carId) {
    await placeRider({ riderOfferId: offer.id, carId: params.carId, source: "host", venue: params.venue });
  }
  return offer;
}

/** Remove a person from the board. Guests are deleted; members are marked withdrawn. */
export async function removeOffer(offerId: string, venue: Venue | null, opts?: { notify?: boolean }) {
  const offer = await prisma.carpoolOffer.findUnique({
    where: { id: offerId },
    include: {
      ...offerWithUser,
      car: { include: { stops: { include: { riderOffer: { include: offerWithUser } } } } },
      stop: true,
    },
  });
  if (!offer) throw new Error("That person isn't on the board");

  if (offer.stop) {
    await unplaceRider(offer.id, venue, { notify: false });
  }

  if (offer.car) {
    if (opts?.notify && offer.car.confirmedAt) {
      const driverName = firstName(offerName(offer));
      for (const s of offer.car.stops) {
        await notifyOffer(s.riderOffer, {
          type: "carpool_driver_withdrew",
          title: "Your ride fell through",
          body: `${driverName} can no longer drive this Sunday. Hosts will find you another car — check Carpool.`,
          emailSubject: "Sundays carpool — your ride changed",
        });
      }
    }
    await prisma.car.delete({ where: { id: offer.car.id } });
  }

  if (offer.userId) {
    await prisma.carpoolOffer.update({ where: { id: offer.id }, data: { status: "withdrawn" } });
  } else {
    await prisma.carpoolOffer.delete({ where: { id: offer.id } });
  }
}

export async function moveOfferPin(offerId: string, lat: number, lng: number, venue: Venue | null) {
  // Keep the label honest: relabel with the nearest street address.
  let relabel: { address: string; neighborhood: string | null } | null = null;
  try {
    const r = await reverseGeocode(lat, lng);
    relabel = { address: r.placeName, neighborhood: r.neighborhood };
  } catch {
    // keep the old text
  }
  const offer = await prisma.carpoolOffer.update({
    where: { id: offerId },
    data: { lat, lng, ...(relabel ?? {}) },
    include: { car: true, stop: true },
  });
  if (offer.car) await recomputeCar(offer.car.id, venue);
  if (offer.stop) {
    await recomputeCar(offer.stop.carId, venue);
    await touchCar(offer.stop.carId);
  }
  return offer;
}

/** When a member signs in, take over any guest write-ins a host made with their email. */
export async function claimGuestOffers(userId: string, email: string) {
  const guests = await prisma.carpoolOffer.findMany({
    where: { userId: null, guestEmail: email.toLowerCase() },
  });
  for (const g of guests) {
    const clash = await prisma.carpoolOffer.findUnique({
      where: { userId_lumaEventId: { userId, lumaEventId: g.lumaEventId } },
    });
    if (clash) continue; // they already have their own offer for that week
    await prisma.carpoolOffer.update({
      where: { id: g.id },
      data: { userId, guestName: null, guestEmail: null },
    });
  }
}

// ─── Event replacement ───────────────────────────────────────────────────────
//
// Hosts sometimes delete and recreate a Sunday on Luma. The old event 404s,
// but the offers, cars and chat built for it are still valid for the new one.

/** Move every offer, car and thread from one event to another. Members who already re-posted on the new event keep the new entry. */
export async function moveCarpoolToEvent(fromId: string, toId: string) {
  if (fromId === toId) return { moved: 0, dropped: 0 };
  let moved = 0;
  let dropped = 0;

  await prisma.$transaction(async (tx) => {
    const offers = await tx.carpoolOffer.findMany({ where: { lumaEventId: fromId } });
    for (const o of offers) {
      if (o.userId) {
        const clash = await tx.carpoolOffer.findUnique({
          where: { userId_lumaEventId: { userId: o.userId, lumaEventId: toId } },
        });
        if (clash) {
          await tx.carpoolOffer.delete({ where: { id: o.id } }); // cascades their old car / stop
          dropped += 1;
          continue;
        }
      }
      await tx.carpoolOffer.update({ where: { id: o.id }, data: { lumaEventId: toId } });
      moved += 1;
    }
    await tx.car.updateMany({ where: { lumaEventId: fromId }, data: { lumaEventId: toId } });
    await tx.eventCache.update({ where: { lumaEventId: fromId }, data: { replacedBy: toId } });
  });

  // The venue or time may differ: refresh route numbers and flag confirmed cars for a re-send.
  const venue = await getVenue(toId);
  const cars = await prisma.car.findMany({ where: { lumaEventId: toId }, select: { id: true, confirmedAt: true } });
  for (const c of cars) {
    await recomputeCar(c.id, venue);
    if (c.confirmedAt) await prisma.car.update({ where: { id: c.id }, data: { changedAt: new Date() } });
  }
  return { moved, dropped };
}

/**
 * After an event disappears from Luma: if an active event starts within 36
 * hours of it, treat that as the recreated version and move the carpool over.
 * Returns the replacement id, or null if hosts need to pick one by hand.
 */
export async function carryOverCarpool(fromId: string): Promise<string | null> {
  const from = await prisma.eventCache.findUnique({ where: { lumaEventId: fromId } });
  if (!from || from.replacedBy) return from?.replacedBy ?? null;
  const waiting = await prisma.carpoolOffer.count({ where: { lumaEventId: fromId, status: "open" } });
  if (waiting === 0) return null;

  const window = 36 * 60 * 60 * 1000;
  const candidates = await prisma.eventCache.findMany({
    where: {
      status: "active",
      lumaEventId: { not: fromId },
      startAt: { gte: new Date(from.startAt.getTime() - window), lte: new Date(from.startAt.getTime() + window) },
    },
  });
  if (candidates.length === 0) return null;
  const to = candidates.sort(
    (a, b) => Math.abs(a.startAt.getTime() - from.startAt.getTime()) - Math.abs(b.startAt.getTime() - from.startAt.getTime())
  )[0];
  await moveCarpoolToEvent(fromId, to.lumaEventId);
  return to.lumaEventId;
}

/** Deleted or cancelled events from the last two weeks that still matter to hosts. */
export async function recentEventChanges(currentEventId: string | null) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const gone = await prisma.eventCache.findMany({
    where: { status: { not: "active" }, updatedAt: { gte: since } },
    orderBy: { updatedAt: "desc" },
  });
  const out: { lumaEventId: string; title: string; status: string; replacedBy: string | null; waiting: number }[] = [];
  for (const e of gone) {
    const waiting = await prisma.carpoolOffer.count({ where: { lumaEventId: e.lumaEventId, status: "open" } });
    if (e.replacedBy === currentEventId || waiting > 0) {
      out.push({ lumaEventId: e.lumaEventId, title: e.title, status: e.status, replacedBy: e.replacedBy, waiting });
    }
  }
  return out;
}
