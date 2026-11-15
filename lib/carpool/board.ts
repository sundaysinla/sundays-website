/**
 * Read models for the carpool screens. Hosts see everything; members see
 * first names and neighborhoods until a host confirms their car, then full
 * names, addresses and contact emails.
 */

import { prisma } from "@/lib/db";
import { firstName, offerEmail, offerName, offerPhone } from "@/lib/carpool/service";
import { listCarMessages, type MessageView } from "@/lib/carpool/messages";
import { haversineKm } from "@/lib/carpool/route";
import { HUBS, hubById, nearestHub, toWallTime, type Hub } from "@/lib/carpool/rideshare";
import type { GhostPin, MapCar, MapPoint, MemberMap } from "@/lib/carpool/map-types";

const offerWithUser = { user: { include: { profile: true } } } as const;

export type PersonView = {
  offerId: string;
  role: "driver" | "rider";
  name: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  guest: boolean;
  address: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  notes: string | null;
  seatsTotal: number | null;
  /** Riders only: the closest Uber meetup spot. */
  nearHub: { name: string; km: number } | null;
};

export type HubView = Hub;

export type StopView = {
  id: string;
  order: number;
  source: "matcher" | "host";
  confirmed: boolean;
  addedKm: number;
  /** Uber groups: straight-line km from the rider's pickup to the hub. */
  walkKm: number | null;
  rider: PersonView;
};

export type CarView = {
  id: string;
  kind: "drive" | "rideshare";
  /** Short name for chips and menus: the driver's first name, or "Uber · UCLA". */
  label: string;
  /** Drive cars only. */
  driver: PersonView | null;
  /** Uber groups only. */
  hub: HubView | null;
  meetAt: string | null;
  /** meetAt as "13:10" in the event's timezone, for the time input. */
  meetTime: string | null;
  bookerOfferId: string | null;
  seatsTotal: number;
  routeKm: number;
  directKm: number;
  detourKm: number;
  confirmedAt: string | null;
  changedAt: string | null;
  pendingStops: number;
  stops: StopView[];
  messages: MessageView[];
};

export type EventView = {
  lumaEventId: string;
  title: string;
  startAt: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export type HostBoard = {
  event: EventView;
  /** Drive cars first, then Uber groups. */
  cars: CarView[];
  unassigned: PersonView[];
  hubs: HubView[];
  counts: { drivers: number; ubers: number; riders: number; seated: number; seats: number };
};

type OfferRow = Parameters<typeof offerName>[0] & {
  id: string;
  role: "driver" | "rider";
  address: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  notes: string | null;
  seatsTotal: number | null;
};

function person(o: OfferRow): PersonView {
  const name = offerName(o);
  const near = o.role === "rider" ? nearestHub(o) : null;
  return {
    offerId: o.id,
    role: o.role,
    name,
    firstName: firstName(name),
    email: offerEmail(o),
    phone: offerPhone(o),
    guest: !o.userId,
    address: o.address,
    neighborhood: o.neighborhood,
    lat: o.lat,
    lng: o.lng,
    notes: o.notes,
    seatsTotal: o.seatsTotal,
    nearHub: near ? { name: near.hub.name, km: near.km } : null,
  };
}

export function eventView(e: {
  lumaEventId: string;
  title: string;
  startAt: Date;
  address: string | null;
  lat: number | null;
  lng: number | null;
}): EventView {
  return {
    lumaEventId: e.lumaEventId,
    title: e.title,
    startAt: e.startAt.toISOString(),
    address: e.address,
    lat: e.lat,
    lng: e.lng,
  };
}

export async function loadHostBoard(lumaEventId: string): Promise<HostBoard | null> {
  const [event, cars, riders] = await Promise.all([
    prisma.eventCache.findUnique({ where: { lumaEventId } }),
    prisma.car.findMany({
      where: { lumaEventId, OR: [{ kind: "rideshare" }, { driverOffer: { status: "open" } }] },
      include: {
        driverOffer: { include: offerWithUser },
        stops: {
          include: { riderOffer: { include: offerWithUser } },
          orderBy: { order: "asc" },
        },
      },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
    prisma.carpoolOffer.findMany({
      where: { lumaEventId, role: "rider", status: "open", stop: null },
      include: offerWithUser,
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!event) return null;

  const threads = await Promise.all(cars.map((c) => listCarMessages(c.id, { revealNames: true })));
  const tz = event.timezone || "America/Los_Angeles";

  // "Uber · UCLA", or "Uber · UCLA 2" when a hub has more than one group.
  const perHub = new Map<string, number>();
  for (const c of cars) if (c.kind === "rideshare") perHub.set(c.hubId ?? "", (perHub.get(c.hubId ?? "") ?? 0) + 1);
  const seen = new Map<string, number>();
  const labelOf = (c: (typeof cars)[number]) => {
    if (c.kind === "drive") return c.driverOffer ? firstName(offerName(c.driverOffer)) : "Car";
    const key = c.hubId ?? "";
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    const base = `Uber · ${hubById(c.hubId)?.campus ?? "?"}`;
    return (perHub.get(key) ?? 0) > 1 ? `${base} ${n}` : base;
  };

  const carViews: CarView[] = cars.map((c, i) => {
    const hub = c.kind === "rideshare" ? hubById(c.hubId) : null;
    return {
      id: c.id,
      kind: c.kind,
      label: labelOf(c),
      messages: threads[i],
      driver: c.driverOffer ? person(c.driverOffer) : null,
      hub,
      meetAt: c.meetAt?.toISOString() ?? null,
      meetTime: c.meetAt ? toWallTime(c.meetAt, tz) : null,
      bookerOfferId: c.bookerOfferId,
      seatsTotal: c.seatsTotal,
      routeKm: c.routeKm,
      directKm: c.directKm,
      detourKm: Math.max(0, c.routeKm - c.directKm),
      confirmedAt: c.confirmedAt?.toISOString() ?? null,
      changedAt: c.changedAt?.toISOString() ?? null,
      pendingStops: c.stops.filter((s) => !s.confirmedAt).length,
      stops: c.stops.map((s) => ({
        id: s.id,
        order: s.order,
        source: s.source,
        confirmed: !!s.confirmedAt,
        addedKm: s.addedKm,
        walkKm: hub ? haversineKm(s.riderOffer, hub) : null,
        rider: person(s.riderOffer),
      })),
    };
  });

  const seated = carViews.reduce((n, c) => n + c.stops.length, 0);
  const seats = carViews.reduce((n, c) => n + c.seatsTotal, 0);
  const ubers = carViews.filter((c) => c.kind === "rideshare").length;

  return {
    event: eventView(event),
    cars: carViews,
    unassigned: riders.map(person),
    hubs: HUBS,
    counts: { drivers: carViews.length - ubers, ubers, riders: seated + riders.length, seated, seats },
  };
}

// ─── Member view ─────────────────────────────────────────────────────────────

export type MemberOffer = {
  id: string;
  role: "driver" | "rider";
  address: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  seatsTotal: number | null;
  notes: string | null;
};

export type RiderRide = {
  kind: "rider";
  carId: string;
  messages: MessageView[];
  status: "suggested" | "confirmed";
  changed: boolean;
  driver: { firstName: string; name: string | null; neighborhood: string | null; email: string | null; phone: string | null };
  stopNumber: number;
  stopCount: number;
  coRiders: { firstName: string; neighborhood: string | null }[];
};

export type DriverRide = {
  kind: "driver";
  carId: string;
  messages: MessageView[];
  status: "suggested" | "confirmed";
  changed: boolean;
  seatsTotal: number;
  routeKm: number;
  detourKm: number;
  stops: {
    order: number;
    firstName: string;
    name: string | null;
    neighborhood: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    confirmed: boolean;
  }[];
};

export type RideshareRide = {
  kind: "rideshare";
  carId: string;
  messages: MessageView[];
  status: "suggested" | "confirmed";
  changed: boolean;
  hub: HubView;
  meetAt: string | null;
  /** Straight-line km from the member's pickup address to the hub. */
  walkKm: number;
  /** Who orders the Uber. */
  booker: { who: "you" } | { who: "host" } | { who: "rider"; firstName: string; name: string | null; phone: string | null };
  coRiders: { firstName: string; name: string | null; phone: string | null }[];
};

export type MemberCarpool = {
  offer: MemberOffer | null;
  ride: RiderRide | DriverRide | RideshareRide | null;
  /** The member's own phone, for the form. */
  phone: string | null;
};

export async function loadMemberCarpool(userId: string, lumaEventId: string): Promise<MemberCarpool> {
  const offer = await prisma.carpoolOffer.findUnique({
    where: { userId_lumaEventId: { userId, lumaEventId } },
    include: {
      car: {
        include: {
          stops: { include: { riderOffer: { include: offerWithUser } }, orderBy: { order: "asc" } },
        },
      },
      stop: {
        include: {
          car: {
            include: {
              driverOffer: { include: offerWithUser },
              stops: { include: { riderOffer: { include: offerWithUser } }, orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { phone: true } });
  const phone = profile?.phone ?? null;

  if (!offer || offer.status === "withdrawn") return { offer: null, ride: null, phone };

  const offerView: MemberOffer = {
    id: offer.id,
    role: offer.role,
    address: offer.address,
    neighborhood: offer.neighborhood,
    lat: offer.lat,
    lng: offer.lng,
    seatsTotal: offer.seatsTotal,
    notes: offer.notes,
  };

  if (offer.role === "rider") {
    const stop = offer.stop;
    if (!stop) return { offer: offerView, ride: null, phone };
    const car = stop.car;
    const confirmed = !!stop.confirmedAt && !!car.confirmedAt;
    const hub = car.kind === "rideshare" ? hubById(car.hubId) : null;

    if (hub) {
      const booker = car.stops.find((s) => s.riderOfferId === car.bookerOfferId) ?? null;
      const reveal = (s: (typeof car.stops)[number]) => confirmed && !!s.confirmedAt;
      return {
        offer: offerView,
        phone,
        ride: {
          kind: "rideshare",
          carId: car.id,
          messages: await listCarMessages(car.id, { revealNames: confirmed }),
          status: confirmed ? "confirmed" : "suggested",
          changed: !!car.changedAt,
          hub,
          meetAt: car.meetAt?.toISOString() ?? null,
          walkKm: haversineKm(offer, hub),
          booker: !booker
            ? { who: "host" }
            : booker.riderOfferId === offer.id
              ? { who: "you" }
              : {
                  who: "rider",
                  firstName: firstName(offerName(booker.riderOffer)),
                  name: reveal(booker) ? offerName(booker.riderOffer) : null,
                  phone: reveal(booker) ? offerPhone(booker.riderOffer) : null,
                },
          coRiders: car.stops
            .filter((s) => s.riderOfferId !== offer.id)
            .map((s) => ({
              firstName: firstName(offerName(s.riderOffer)),
              name: reveal(s) ? offerName(s.riderOffer) : null,
              phone: reveal(s) ? offerPhone(s.riderOffer) : null,
            })),
        },
      };
    }

    if (!car.driverOffer) return { offer: offerView, ride: null, phone };
    const driverName = offerName(car.driverOffer);
    return {
      offer: offerView,
      phone,
      ride: {
        kind: "rider",
        carId: car.id,
        messages: await listCarMessages(car.id, { revealNames: confirmed }),
        status: confirmed ? "confirmed" : "suggested",
        changed: !!car.changedAt,
        driver: {
          firstName: firstName(driverName),
          name: confirmed ? driverName : null,
          neighborhood: car.driverOffer.neighborhood,
          email: confirmed ? offerEmail(car.driverOffer) : null,
          phone: confirmed ? offerPhone(car.driverOffer) : null,
        },
        stopNumber: stop.order + 1,
        stopCount: car.stops.length,
        coRiders: car.stops
          .filter((s) => s.riderOfferId !== offer.id)
          .map((s) => ({
            firstName: firstName(offerName(s.riderOffer)),
            neighborhood: s.riderOffer.neighborhood,
          })),
      },
    };
  }

  const car = offer.car;
  if (!car) return { offer: offerView, ride: null, phone };
  const confirmed = !!car.confirmedAt;
  return {
    offer: offerView,
    phone,
    ride: {
      kind: "driver",
      carId: car.id,
      messages: await listCarMessages(car.id, { revealNames: confirmed }),
      status: confirmed ? "confirmed" : "suggested",
      changed: !!car.changedAt,
      seatsTotal: car.seatsTotal,
      routeKm: car.routeKm,
      detourKm: Math.max(0, car.routeKm - car.directKm),
      stops: car.stops.map((s) => {
        const name = offerName(s.riderOffer);
        const stopConfirmed = confirmed && !!s.confirmedAt;
        return {
          order: s.order,
          firstName: firstName(name),
          name: stopConfirmed ? name : null,
          neighborhood: s.riderOffer.neighborhood,
          address: stopConfirmed ? s.riderOffer.address : null,
          email: stopConfirmed ? offerEmail(s.riderOffer) : null,
          phone: stopConfirmed ? offerPhone(s.riderOffer) : null,
          confirmed: stopConfirmed,
        };
      }),
    },
  };
}

// ─── Member map ──────────────────────────────────────────────────────────────
//
// Members see the venue, their own exact pin, and everyone else rounded to
// roughly a kilometer with no name. Car-mates get a first name once a host
// has suggested the car, and exact pins plus the route once it's confirmed.

function roundKm(n: number) {
  return Math.round(n * 100) / 100;
}

export async function loadMemberMap(userId: string, lumaEventId: string): Promise<MemberMap> {
  const offers = await prisma.carpoolOffer.findMany({
    where: { lumaEventId, status: "open" },
    include: {
      ...offerWithUser,
      car: {
        include: { stops: { include: { riderOffer: { include: offerWithUser } }, orderBy: { order: "asc" } } },
      },
      stop: {
        include: {
          car: {
            include: {
              driverOffer: { include: offerWithUser },
              stops: { include: { riderOffer: { include: offerWithUser } }, orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });

  const me = offers.find((o) => o.userId === userId) ?? null;
  const pt = (o: { id: string; lat: number; lng: number } & Parameters<typeof offerName>[0]): MapPoint => ({
    offerId: o.id,
    lat: o.lat,
    lng: o.lng,
    name: offerName(o),
  });
  const ghost = (o: { lat: number; lng: number }, label: string | null): GhostPin => ({
    lat: roundKm(o.lat),
    lng: roundKm(o.lng),
    label,
  });

  const ghosts: GhostPin[] = [];
  const shown = new Set<string>();
  let car: MapCar | null = null;
  let selfDrawnInCar = false;

  if (me) {
    shown.add(me.id);
    const myCar = me.role === "driver" ? me.car : me.stop?.car ?? null;
    const myHub = myCar?.kind === "rideshare" ? hubById(myCar.hubId) : null;
    if (myCar && myHub) {
      // Uber riders meet at the hub, so everyone else in the group stays an anonymous dot.
      car = {
        id: myCar.id,
        color: "#1A1A17",
        driver: null,
        hub: { lat: myHub.lat, lng: myHub.lng, label: myHub.name },
        stops: [],
      };
    } else if (myCar && (me.role === "driver" || me.stop?.car.driverOffer)) {
      const driver = me.role === "driver" ? me : me.stop!.car.driverOffer!;
      const stops = myCar.stops;
      const confirmed = !!myCar.confirmedAt && (me.role === "driver" || !!me.stop?.confirmedAt);
      shown.add(driver.id);
      for (const s of stops) shown.add(s.riderOfferId);

      if (confirmed) {
        const exact = stops.filter((s) => s.confirmedAt || s.riderOfferId === me.id);
        car = {
          id: myCar.id,
          color: "#1A1A17",
          driver: pt(driver),
          stops: exact.map((s) => ({ ...pt(s.riderOffer), order: s.order, confirmed: true })),
        };
        selfDrawnInCar = true;
        for (const s of stops) {
          if (!s.confirmedAt && s.riderOfferId !== me.id) {
            ghosts.push(ghost(s.riderOffer, firstName(offerName(s.riderOffer))));
          }
        }
      } else {
        if (driver.id !== me.id) ghosts.push(ghost(driver, firstName(offerName(driver))));
        for (const s of stops) {
          if (s.riderOfferId !== me.id) ghosts.push(ghost(s.riderOffer, firstName(offerName(s.riderOffer))));
        }
      }
    }
  }

  for (const o of offers) {
    if (!shown.has(o.id)) ghosts.push(ghost(o, null));
  }

  return {
    self: me && !selfDrawnInCar ? pt(me) : null,
    car,
    ghosts,
  };
}
