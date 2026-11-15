/**
 * Read models for the carpool screens. Hosts see everything; members see
 * first names and neighborhoods until a host confirms their car, then full
 * names, addresses and contact emails.
 */

import { prisma } from "@/lib/db";
import { firstName, offerEmail, offerName, offerPhone } from "@/lib/carpool/service";
import { listCarMessages, type MessageView } from "@/lib/carpool/messages";
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
};

export type StopView = {
  id: string;
  order: number;
  source: "matcher" | "host";
  confirmed: boolean;
  addedKm: number;
  rider: PersonView;
};

export type CarView = {
  id: string;
  driver: PersonView;
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
  cars: CarView[];
  unassigned: PersonView[];
  counts: { drivers: number; riders: number; seated: number; seats: number };
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
      where: { lumaEventId, driverOffer: { status: "open" } },
      include: {
        driverOffer: { include: offerWithUser },
        stops: {
          include: { riderOffer: { include: offerWithUser } },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.carpoolOffer.findMany({
      where: { lumaEventId, role: "rider", status: "open", stop: null },
      include: offerWithUser,
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!event) return null;

  const threads = await Promise.all(cars.map((c) => listCarMessages(c.id, { revealNames: true })));

  const carViews: CarView[] = cars.map((c, i) => ({
    id: c.id,
    messages: threads[i],
    driver: person(c.driverOffer),
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
      rider: person(s.riderOffer),
    })),
  }));

  const seated = carViews.reduce((n, c) => n + c.stops.length, 0);
  const seats = carViews.reduce((n, c) => n + c.seatsTotal, 0);

  return {
    event: eventView(event),
    cars: carViews,
    unassigned: riders.map(person),
    counts: { drivers: carViews.length, riders: seated + riders.length, seated, seats },
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

export type MemberCarpool = {
  offer: MemberOffer | null;
  ride: RiderRide | DriverRide | null;
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
    if (myCar) {
      const driver = me.role === "driver" ? me : me.stop!.car.driverOffer;
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
