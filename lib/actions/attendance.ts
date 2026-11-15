"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { addWalkIn, saveMeetingNote, setCheckedIn, syncEventGuests, toggleMeeting } from "@/lib/attendance";
import type { ActionResult } from "@/lib/actions/profile";

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function adminSyncGuests(formData: FormData): Promise<ActionResult & { synced?: number }> {
  try {
    await requireAdmin();
    const lumaEventId = String(formData.get("lumaEventId") || "");
    if (!lumaEventId) return { ok: false, error: "Missing event" };
    const r = await syncEventGuests(lumaEventId, { force: true });
    revalidatePath("/portal/admin/checkin");
    return { ok: true, synced: r.synced };
  } catch (e) {
    return fail(e, "Couldn't pull the guest list");
  }
}

export async function adminSetCheckedIn(formData: FormData): Promise<ActionResult> {
  try {
    const host = await requireAdmin();
    const attendanceId = String(formData.get("attendanceId") || "");
    const on = String(formData.get("on") || "") === "1";
    if (!attendanceId) return { ok: false, error: "Missing person" };
    await setCheckedIn(attendanceId, on, host.id!);
    revalidatePath("/portal/admin/checkin");
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't update check-in");
  }
}

export async function adminAddWalkIn(formData: FormData): Promise<ActionResult> {
  try {
    const host = await requireAdmin();
    const lumaEventId = String(formData.get("lumaEventId") || "");
    if (!lumaEventId) return { ok: false, error: "Missing event" };
    await addWalkIn({
      lumaEventId,
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || "") || null,
      byUserId: host.id!,
    });
    revalidatePath("/portal/admin/checkin");
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't add that person");
  }
}

/** Member: mark or unmark someone as met at a Sunday. */
export async function toggleMet(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
    const limited = checkRateLimit(`met:${session.user.id}`, 60, 60_000);
    if (!limited.ok) return { ok: false, error: "Slow down a little." };
    const lumaEventId = String(formData.get("lumaEventId") || "");
    const attendanceId = String(formData.get("attendanceId") || "");
    const on = String(formData.get("on") || "") === "1";
    if (!lumaEventId || !attendanceId) return { ok: false, error: "Missing person" };
    await toggleMeeting(session.user.id, lumaEventId, attendanceId, on);
    revalidatePath("/portal/met");
    revalidatePath("/portal/profile");
    revalidatePath("/portal");
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't save that");
  }
}

/** Member: save what you talked about with someone. */
export async function saveMetNote(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
    const limited = checkRateLimit(`met-note:${session.user.id}`, 60, 60_000);
    if (!limited.ok) return { ok: false, error: "Slow down a little." };
    const lumaEventId = String(formData.get("lumaEventId") || "");
    const attendanceId = String(formData.get("attendanceId") || "");
    const note = String(formData.get("note") || "");
    if (!lumaEventId || !attendanceId) return { ok: false, error: "Missing person" };
    await saveMeetingNote(session.user.id, lumaEventId, attendanceId, note);
    revalidatePath("/portal/met");
    revalidatePath("/portal/profile");
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't save that note");
  }
}
