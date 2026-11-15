"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureProfile } from "@/lib/profile";
import { geocodeAddress } from "@/lib/geo";
import { getUpcomingCachedEvent, syncUpcomingEvents } from "@/lib/luma-sync";
import { checkRateLimit } from "@/lib/rate-limit";
import { haversineKm } from "@/lib/carpool/route";
import {
  ensureCarForOffer,
  getVenue,
  notifyOffer,
  firstName,
  removeOffer,
  unplaceRider,
} from "@/lib/carpool/service";
import type { ActionResult } from "@/lib/actions/profile";
import { offerIsInCar, postCarMessage as postMessage } from "@/lib/carpool/messages";
import { normalizePhone } from "@/lib/phone";
import type { CarpoolRole } from "@prisma/client";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

/** Members post or edit their own offer. No matching runs here — hosts trigger it. */
export async function upsertCarpoolOffer(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const limited = checkRateLimit(`carpool-offer:${user.id}`, 10, 60_000);
    if (!limited.ok) return { ok: false, error: "Too many updates — try again shortly." };

    await ensureProfile(user.id!, user);
    try {
      await syncUpcomingEvents();
    } catch {
      // stale cache is fine
    }
    const event = await getUpcomingCachedEvent();
    if (!event) return { ok: false, error: "No upcoming Sundays event yet — check back once it's on Luma." };
    const venue = await getVenue(event.lumaEventId);

    const roleRaw = String(formData.get("role") || "");
    if (roleRaw !== "driver" && roleRaw !== "rider") return { ok: false, error: "Choose whether you need a ride or can drive" };
    const role = roleRaw as CarpoolRole;

    const address = String(formData.get("address") || "").trim();
    if (!address) return { ok: false, error: role === "driver" ? "Enter where you'll start from" : "Enter a pickup address" };

    const notes = String(formData.get("notes") || "").trim() || null;
    const seatsTotal = role === "driver" ? Math.max(1, Math.min(8, Number(formData.get("seatsTotal") || 2))) : null;

    const phoneRaw = String(formData.get("phone") || "").trim();
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) return { ok: false, error: "That phone number doesn't look right — use 10 digits, or +country code" };
    await prisma.profile.update({ where: { userId: user.id! }, data: { phone } });

    // The address field supplies coordinates when a suggestion was picked; otherwise geocode.
    const latRaw = Number(formData.get("lat"));
    const lngRaw = Number(formData.get("lng"));
    let geo: { lat: number; lng: number; placeName: string; neighborhood: string | null };
    if (Number.isFinite(latRaw) && Number.isFinite(lngRaw) && latRaw !== 0 && lngRaw !== 0) {
      geo = {
        lat: latRaw,
        lng: lngRaw,
        placeName: String(formData.get("placeName") || address),
        neighborhood: String(formData.get("neighborhood") || "").trim() || null,
      };
    } else {
      geo = await geocodeAddress(address);
    }

    const existing = await prisma.carpoolOffer.findUnique({
      where: { userId_lumaEventId: { userId: user.id!, lumaEventId: event.lumaEventId } },
      include: { car: { include: { stops: { include: { riderOffer: { include: { user: { include: { profile: true } } } } } } } }, stop: true },
    });

    if (existing && existing.status === "open") {
      const moved = haversineKm(existing, geo) > 0.3;
      if (existing.role !== role) {
        // Switching sides: tear down the old placement.
        if (existing.car) {
          if (existing.car.confirmedAt) {
            const me = firstName(user.name || "Your driver");
            for (const s of existing.car.stops) {
              await notifyOffer(s.riderOffer, {
                type: "carpool_driver_withdrew",
                title: "Your ride fell through",
                body: `${me} can no longer drive this Sunday. Hosts will find you another car — check Carpool.`,
                emailSubject: "Sundays carpool — your ride changed",
              });
            }
          }
          await prisma.car.delete({ where: { id: existing.car.id } });
        }
        if (existing.stop) await unplaceRider(existing.id, venue);
      } else if (role === "rider" && moved && existing.stop) {
        // New pickup point: drop out of the car so a host re-places them.
        await unplaceRider(existing.id, venue);
      }
    }

    const offer = await prisma.carpoolOffer.upsert({
      where: { userId_lumaEventId: { userId: user.id!, lumaEventId: event.lumaEventId } },
      create: {
        userId: user.id!,
        lumaEventId: event.lumaEventId,
        role,
        address: geo.placeName,
        lat: geo.lat,
        lng: geo.lng,
        neighborhood: geo.neighborhood,
        seatsTotal,
        notes,
        status: "open",
      },
      update: {
        role,
        address: geo.placeName,
        lat: geo.lat,
        lng: geo.lng,
        neighborhood: geo.neighborhood,
        seatsTotal,
        notes,
        status: "open",
      },
    });

    if (role === "driver") await ensureCarForOffer(offer.id, venue);

    revalidatePath("/portal/carpool");
    revalidatePath("/portal/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save your carpool details" };
  }
}

export async function withdrawCarpoolOffer(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const event = await getUpcomingCachedEvent();
    if (!event) return { ok: false, error: "No upcoming event" };

    const offer = await prisma.carpoolOffer.findUnique({
      where: { userId_lumaEventId: { userId: user.id!, lumaEventId: event.lumaEventId } },
    });
    if (!offer || offer.status === "withdrawn") return { ok: false, error: "You're not on this week's board" };

    const venue = await getVenue(event.lumaEventId);
    await removeOffer(offer.id, venue, { notify: true });

    revalidatePath("/portal/carpool");
    revalidatePath("/portal/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't withdraw" };
  }
}

/** Post in your car's thread. Allowed once you're the driver or seated in the car. */
export async function postCarMessage(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const limited = checkRateLimit(`carpool-msg:${user.id}`, 20, 60_000);
    if (!limited.ok) return { ok: false, error: "Slow down a little — try again in a minute." };
    const carId = String(formData.get("carId") || "");
    const body = String(formData.get("body") || "");
    const event = await getUpcomingCachedEvent();
    if (!event) return { ok: false, error: "No upcoming event" };
    const offer = await prisma.carpoolOffer.findUnique({
      where: { userId_lumaEventId: { userId: user.id!, lumaEventId: event.lumaEventId } },
    });
    if (!offer || offer.status !== "open") return { ok: false, error: "You're not on this week's board" };
    if (!(await offerIsInCar(offer.id, carId))) return { ok: false, error: "You're not in this car" };
    await postMessage({ carId, body, author: { offerId: offer.id } });
    revalidatePath("/portal/carpool");
    revalidatePath("/portal/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't post that" };
  }
}
