"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { getUpcomingCachedEvent, syncUpcomingEvents } from "@/lib/luma-sync";
import {
  confirmCar,
  createRideshare,
  getVenue,
  moveCarpoolToEvent,
  moveOfferPin,
  optimizeCar,
  placeRider,
  removeOffer,
  removeRideshare,
  reorderCar,
  setCarSeats,
  suggestForEvent,
  uberTheRest,
  unplaceRider,
  updateRideshare,
  writeInPerson,
} from "@/lib/carpool/service";
import { fromWallTime } from "@/lib/carpool/rideshare";
import type { ActionResult } from "@/lib/actions/profile";
import { commitImport, previewImport, type ImportRow } from "@/lib/carpool/import";
import { postCarMessage } from "@/lib/carpool/messages";

function refresh() {
  revalidatePath("/portal/admin");
  revalidatePath("/portal/carpool");
}

async function eventContext() {
  await requireAdmin();
  const event = await getUpcomingCachedEvent();
  if (!event) throw new Error("No upcoming event is cached — sync Luma first");
  const venue = await getVenue(event.lumaEventId);
  return { event, venue };
}

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function adminSyncLuma(): Promise<ActionResult> {
  try {
    await requireAdmin();
    await syncUpcomingEvents({ force: true });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Luma sync failed");
  }
}

export async function adminSuggest(): Promise<ActionResult & { placed?: number; unplaced?: number }> {
  try {
    const { event } = await eventContext();
    const r = await suggestForEvent(event.lumaEventId);
    refresh();
    return { ok: true, ...r };
  } catch (e) {
    return fail(e, "Couldn't suggest placements");
  }
}

// ─── Uber groups ─────────────────────────────────────────────────────────────

export async function adminUberTheRest(): Promise<ActionResult & { placed?: number; groups?: number; skipped?: string[] }> {
  try {
    const { event } = await eventContext();
    const r = await uberTheRest(event.lumaEventId);
    refresh();
    return { ok: true, ...r };
  } catch (e) {
    return fail(e, "Couldn't group riders into Ubers");
  }
}

export async function adminCreateRideshare(formData: FormData): Promise<ActionResult> {
  try {
    const { event, venue } = await eventContext();
    const hubId = String(formData.get("hubId") || "");
    await createRideshare({ lumaEventId: event.lumaEventId, hubId, venue });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't start an Uber group");
  }
}

/** Any of hubId, meetTime ("13:10", event timezone) or bookerOfferId ("host" = a host orders). */
export async function adminUpdateRideshare(formData: FormData): Promise<ActionResult> {
  try {
    const { event, venue } = await eventContext();
    const carId = String(formData.get("carId") || "");
    if (!carId) return { ok: false, error: "Missing Uber" };
    const changes: Parameters<typeof updateRideshare>[1] = {};
    if (formData.has("hubId")) changes.hubId = String(formData.get("hubId"));
    if (formData.has("meetTime")) {
      const meetAt = fromWallTime(event.startAt, String(formData.get("meetTime")), event.timezone || "America/Los_Angeles");
      if (!meetAt) return { ok: false, error: "Enter a time like 1:15 PM" };
      changes.meetAt = meetAt;
    }
    if (formData.has("bookerOfferId")) {
      const b = String(formData.get("bookerOfferId"));
      changes.bookerOfferId = b === "host" ? null : b;
    }
    await updateRideshare(carId, changes, venue);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't update that Uber");
  }
}

export async function adminRemoveRideshare(formData: FormData): Promise<ActionResult> {
  try {
    await eventContext();
    const carId = String(formData.get("carId") || "");
    if (!carId) return { ok: false, error: "Missing Uber" };
    await removeRideshare(carId, { notify: true });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't cancel that Uber");
  }
}

export async function adminPlaceRider(formData: FormData): Promise<ActionResult> {
  try {
    const { venue } = await eventContext();
    const riderOfferId = String(formData.get("riderOfferId") || "");
    const carId = String(formData.get("carId") || "");
    const indexRaw = formData.get("index");
    const index = indexRaw != null && indexRaw !== "" ? Number(indexRaw) : undefined;
    if (!riderOfferId || !carId) return { ok: false, error: "Pick a rider and a car" };
    await placeRider({ riderOfferId, carId, index, source: "host", venue });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't place that rider");
  }
}

export async function adminUnplaceRider(formData: FormData): Promise<ActionResult> {
  try {
    const { venue } = await eventContext();
    const riderOfferId = String(formData.get("riderOfferId") || "");
    if (!riderOfferId) return { ok: false, error: "Missing rider" };
    await unplaceRider(riderOfferId, venue, { notify: true });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't remove that rider from the car");
  }
}

export async function adminReorderCar(formData: FormData): Promise<ActionResult> {
  try {
    const { venue } = await eventContext();
    const carId = String(formData.get("carId") || "");
    const stopIds = String(formData.get("stopIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!carId || stopIds.length === 0) return { ok: false, error: "Nothing to reorder" };
    await reorderCar(carId, stopIds, venue);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't reorder stops");
  }
}

export async function adminOptimizeCar(formData: FormData): Promise<ActionResult> {
  try {
    const { venue } = await eventContext();
    const carId = String(formData.get("carId") || "");
    if (!carId) return { ok: false, error: "Missing car" };
    await optimizeCar(carId, venue);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't optimize that route");
  }
}

export async function adminSetSeats(formData: FormData): Promise<ActionResult> {
  try {
    const { venue } = await eventContext();
    const carId = String(formData.get("carId") || "");
    const seats = Number(formData.get("seatsTotal"));
    if (!carId || !Number.isFinite(seats)) return { ok: false, error: "Enter a seat count" };
    await setCarSeats(carId, seats, venue);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't update seats");
  }
}

export async function adminConfirmCar(formData: FormData): Promise<ActionResult> {
  try {
    await eventContext();
    const carId = String(formData.get("carId") || "");
    if (!carId) return { ok: false, error: "Missing car" };
    await confirmCar(carId);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't confirm that car");
  }
}

export async function adminWriteIn(formData: FormData): Promise<ActionResult> {
  try {
    const { event, venue } = await eventContext();
    const roleRaw = String(formData.get("role") || "rider");
    if (roleRaw !== "driver" && roleRaw !== "rider") return { ok: false, error: "Choose driver or rider" };
    await writeInPerson({
      lumaEventId: event.lumaEventId,
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      role: roleRaw,
      address: String(formData.get("address") || "") || null,
      seatsTotal: roleRaw === "driver" ? Number(formData.get("seatsTotal") || 3) : null,
      notes: String(formData.get("notes") || "") || null,
      carId: String(formData.get("carId") || "") || null,
      venue,
      venueAddress: event.address,
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't add that person");
  }
}

export async function adminRemoveOffer(formData: FormData): Promise<ActionResult> {
  try {
    const { venue } = await eventContext();
    const offerId = String(formData.get("offerId") || "");
    if (!offerId) return { ok: false, error: "Missing person" };
    await removeOffer(offerId, venue, { notify: true });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't remove that person");
  }
}

export async function adminMovePin(formData: FormData): Promise<ActionResult> {
  try {
    const { venue } = await eventContext();
    const offerId = String(formData.get("offerId") || "");
    const lat = Number(formData.get("lat"));
    const lng = Number(formData.get("lng"));
    if (!offerId || !Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: "Bad pin position" };
    await moveOfferPin(offerId, lat, lng, venue);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't move that pin");
  }
}

// ─── Spreadsheet import ──────────────────────────────────────────────────────

export async function adminImportPreview(
  formData: FormData
): Promise<{ ok: true; rows: ImportRow[]; headers: string[] } | { ok: false; error: string }> {
  try {
    const { event, venue } = await eventContext();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a .csv or .xlsx file" };
    if (file.size > 2 * 1024 * 1024) return { ok: false, error: "That file is over 2 MB" };
    const data = await file.arrayBuffer();
    const result = await previewImport(data, { lumaEventId: event.lumaEventId, venue, venueAddress: event.address });
    return { ok: true, ...result };
  } catch (e) {
    return fail(e, "Couldn't read that file");
  }
}

export async function adminImportCommit(
  formData: FormData
): Promise<{ ok: true; created: number; placed: number; failed: string[] } | { ok: false; error: string }> {
  try {
    const { event, venue } = await eventContext();
    const raw = String(formData.get("rows") || "[]");
    const rows = JSON.parse(raw) as ImportRow[];
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "Nothing to import" };
    const result = await commitImport(rows, { lumaEventId: event.lumaEventId, venue, venueAddress: event.address });
    refresh();
    return { ok: true, ...result };
  } catch (e) {
    return fail(e, "Import failed");
  }
}

// ─── Car messages ────────────────────────────────────────────────────────────

export async function adminPostCarMessage(formData: FormData): Promise<ActionResult> {
  try {
    const host = await requireAdmin();
    const carId = String(formData.get("carId") || "");
    const body = String(formData.get("body") || "");
    if (!carId) return { ok: false, error: "Missing car" };
    await postCarMessage({ carId, body, author: { hostName: host.name || "Host" } });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't post that");
  }
}

// ─── Event replacement ───────────────────────────────────────────────────────

/** Move the carpool built for a deleted / cancelled event onto this week's event. */
export async function adminMoveCarpool(formData: FormData): Promise<ActionResult> {
  try {
    const { event } = await eventContext();
    const fromId = String(formData.get("fromId") || "");
    if (!fromId) return { ok: false, error: "Missing event" };
    await moveCarpoolToEvent(fromId, event.lumaEventId);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't move the carpool");
  }
}
