/**
 * Spreadsheet import for the host board. Accepts .csv / .xlsx / .xls with a
 * header row. Columns are matched by name, loosely:
 *
 *   name, email, phone, role, address, seats, notes, car
 *
 * `role` is driver / rider (blank = rider, or driver if seats > 0).
 * `car` names a driver, in the same file or already on the board, to seat the
 * rider with. Preview geocodes every address so the host sees problems before
 * anything is written; commit reuses those coordinates.
 */

import { geocodeAddress } from "@/lib/geo";
import { prisma } from "@/lib/db";
import { placeRider, writeInPerson, type Venue } from "@/lib/carpool/service";
import { hasNameColumn, matchesDriver, parseRows, parseSheet, type ParsedRow } from "@/lib/carpool/import-parse";

export type ImportRow = ParsedRow & {
  geo: { lat: number; lng: number; placeName: string; neighborhood: string | null } | null;
};

export type ImportContext = {
  lumaEventId: string;
  venue: Venue | null;
  venueAddress: string | null;
};

export async function previewImport(data: ArrayBuffer, ctx: ImportContext): Promise<{ rows: ImportRow[]; headers: string[] }> {
  const { headers, records } = parseSheet(data);
  if (records.length === 0) throw new Error("No rows found under the header row");
  if (records.length > 200) throw new Error("That's more than 200 rows — split the file");
  if (!hasNameColumn(headers)) {
    throw new Error(`Couldn't find a "name" column. Headers seen: ${headers.join(", ")}`);
  }

  const existing = await prisma.carpoolOffer.findMany({
    where: { lumaEventId: ctx.lumaEventId, status: "open" },
    include: { user: { include: { profile: true } }, car: { select: { id: true } } },
  });
  const nameOf = (o: (typeof existing)[number]) =>
    (o.user?.profile?.displayName || o.user?.name || o.guestName || "").trim();
  const existingNames = new Set(existing.map((o) => nameOf(o).toLowerCase()).filter(Boolean));
  const existingEmails = new Set(
    existing.map((o) => (o.user?.profile?.contactEmail || o.user?.email || o.guestEmail || "").toLowerCase()).filter(Boolean)
  );
  const existingDrivers = existing.filter((o) => o.role === "driver" && o.car).map(nameOf);

  const rows: ImportRow[] = parseRows(records).map((r) => ({ ...r, geo: null }));
  const fileDrivers = rows.filter((r) => r.role === "driver" && r.name && !r.skip).map((r) => r.name);

  for (const r of rows) {
    if (!r.name) continue;
    if (existingNames.has(r.name.toLowerCase()) || (r.email && existingEmails.has(r.email))) {
      r.issues.push("Already on this week's board; skipped");
      r.skip = true;
    }
    if (r.car && !matchesDriver(r.car, [...fileDrivers, ...existingDrivers])) {
      r.issues.push(`No driver named "${r.car}"; will stay unassigned`);
    }
  }

  // Geocode, sequentially to be polite to Mapbox.
  for (const r of rows) {
    if (r.skip) continue;
    if (!r.address) {
      if (ctx.venue) {
        r.geo = { ...ctx.venue, placeName: ctx.venueAddress || "Near the venue", neighborhood: null };
        r.issues.push("No address; pinned at the venue — use Fix pin after import");
      } else {
        r.issues.push("No address and the venue has no location");
        r.skip = true;
      }
      continue;
    }
    try {
      r.geo = await geocodeAddress(r.address);
    } catch (e) {
      if (ctx.venue) {
        r.geo = { ...ctx.venue, placeName: r.address, neighborhood: null };
        r.issues.push(`Couldn't find "${r.address}"; pinned at the venue`);
      } else {
        r.issues.push(e instanceof Error ? e.message : "Couldn't geocode");
        r.skip = true;
      }
    }
  }

  return { rows, headers };
}

export async function commitImport(rows: ImportRow[], ctx: ImportContext) {
  const todo = rows.filter((r) => !r.skip && r.name && r.geo);
  const drivers = todo.filter((r) => r.role === "driver");
  const riders = todo.filter((r) => r.role === "rider");

  // Existing drivers on the board, by lowercase full name and first name.
  const cars = await prisma.car.findMany({
    where: { lumaEventId: ctx.lumaEventId, driverOffer: { status: "open" } },
    include: { driverOffer: { include: { user: { include: { profile: true } } } } },
  });
  const carByName = new Map<string, string>();
  const remember = (name: string, carId: string) => {
    const k = name.trim().toLowerCase();
    if (!k) return;
    carByName.set(k, carId);
    const first = k.split(/\s+/)[0];
    if (!carByName.has(first)) carByName.set(first, carId);
  };
  for (const c of cars) {
    remember(c.driverOffer.user?.profile?.displayName || c.driverOffer.user?.name || c.driverOffer.guestName || "", c.id);
  }

  let created = 0;
  let placed = 0;
  const failed: string[] = [];

  for (const r of drivers) {
    try {
      const offer = await writeInPerson({
        lumaEventId: ctx.lumaEventId,
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: "driver",
        geo: r.geo,
        seatsTotal: r.seats,
        notes: r.notes,
        venue: ctx.venue,
        venueAddress: ctx.venueAddress,
      });
      const car = await prisma.car.findUnique({ where: { driverOfferId: offer.id }, select: { id: true } });
      if (car) remember(r.name, car.id);
      created += 1;
    } catch (e) {
      failed.push(`${r.name}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  for (const r of riders) {
    try {
      const carId = r.car ? carByName.get(r.car.trim().toLowerCase()) ?? null : null;
      const offer = await writeInPerson({
        lumaEventId: ctx.lumaEventId,
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: "rider",
        geo: r.geo,
        notes: r.notes,
        venue: ctx.venue,
        venueAddress: ctx.venueAddress,
      });
      created += 1;
      if (carId) {
        try {
          await placeRider({ riderOfferId: offer.id, carId, source: "host", venue: ctx.venue });
          placed += 1;
        } catch (e) {
          failed.push(`${r.name} not seated: ${e instanceof Error ? e.message : "car full"}`);
        }
      }
    } catch (e) {
      failed.push(`${r.name}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { created, placed, failed };
}
