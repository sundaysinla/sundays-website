import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  eventAddress,
  getEvent,
  listCalendarEvents,
  listGuests,
  parseEventCoords,
  resolveLumaEventId,
  type LumaEvent,
  LumaError,
} from "@/lib/luma";
import { carryOverCarpool } from "@/lib/carpool/service";

function toCacheData(event: LumaEvent) {
  const id = resolveLumaEventId(event);
  if (!id) throw new Error("Luma event missing id");
  const { lat, lng } = parseEventCoords(event);
  return {
    lumaEventId: id,
    title: event.name,
    startAt: new Date(event.start_at),
    endAt: event.end_at ? new Date(event.end_at) : null,
    timezone: event.timezone ?? null,
    address: eventAddress(event),
    lat,
    lng,
    lumaUrl: event.url ?? null,
    coverUrl: event.cover_url ?? null,
    registrationQuestions: (event.registration_questions ??
      []) as Prisma.InputJsonValue,
  };
}

// Pages sync on every load (and the carpool page polls), so cap calls to Luma.
let lastSyncAt = 0;
const SYNC_GAP_MS = 2 * 60 * 1000;

export async function syncUpcomingEvents(opts?: { force?: boolean }) {
  if (!process.env.LUMA_API_KEY) {
    return { synced: 0, skipped: true as const };
  }
  if (!opts?.force && Date.now() - lastSyncAt < SYNC_GAP_MS) {
    return { synced: 0, skipped: true as const };
  }
  lastSyncAt = Date.now();

  const after = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { entries } = await listCalendarEvents({ after, pagination_limit: 50 });
  const now = new Date();
  const seen = new Set<string>();

  let synced = 0;
  for (const entry of entries) {
    const id = resolveLumaEventId(entry);
    if (!id) continue;
    seen.add(id);

    // List entries may omit registration questions — fetch full event when needed
    let full = entry;
    if (!entry.registration_questions) {
      try {
        full = await getEvent(id);
      } catch {
        full = entry;
      }
    }

    const data = toCacheData(full);
    await prisma.eventCache.upsert({
      where: { lumaEventId: data.lumaEventId },
      create: data,
      update: {
        title: data.title,
        startAt: data.startAt,
        endAt: data.endAt,
        timezone: data.timezone,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        lumaUrl: data.lumaUrl,
        coverUrl: data.coverUrl,
        registrationQuestions: data.registrationQuestions,
        status: "active",
        lastSeenAt: now,
      },
    });
    synced += 1;
  }

  await reconcileMissingEvents(seen, now);

  return { synced, skipped: false as const };
}

/**
 * Cached upcoming events that Luma no longer lists were deleted, cancelled,
 * or rescheduled. Ask Luma about each one: a 404 means deleted; anything else
 * refreshes the row. Either way the carpool built for it is carried over to
 * the recreated event when there is one.
 */
async function reconcileMissingEvents(seen: Set<string>, now: Date) {
  const missing = await prisma.eventCache.findMany({
    where: {
      status: "active",
      lumaEventId: { notIn: [...seen] },
      startAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
    },
  });

  for (const ev of missing) {
    try {
      const full = await getEvent(ev.lumaEventId);
      const data = toCacheData(full);
      const stillUpcoming = data.startAt.getTime() >= now.getTime() - 6 * 60 * 60 * 1000;
      // Luma answers for it but doesn't list it: hidden or cancelled. A later
      // listing flips it back to active automatically.
      await prisma.eventCache.update({
        where: { lumaEventId: ev.lumaEventId },
        data: {
          title: data.title,
          startAt: data.startAt,
          endAt: data.endAt,
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          lumaUrl: data.lumaUrl,
          coverUrl: data.coverUrl,
          status: stillUpcoming ? "cancelled" : "active",
        },
      });
      if (stillUpcoming) await carryOverCarpool(ev.lumaEventId);
    } catch (e) {
      if (e instanceof LumaError && (e.status === 404 || e.status === 400)) {
        await prisma.eventCache.update({ where: { lumaEventId: ev.lumaEventId }, data: { status: "deleted" } });
        try {
          await carryOverCarpool(ev.lumaEventId);
        } catch (err) {
          console.warn("[luma] carry-over failed for", ev.lumaEventId, err);
        }
      } else {
        console.warn("[luma] couldn't verify", ev.lumaEventId, e);
      }
    }
  }
}

export async function getUpcomingCachedEvent() {
  return prisma.eventCache.findFirst({
    where: { status: "active", startAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
    orderBy: { startAt: "asc" },
  });
}

export async function syncUserAttendance(userId: string) {
  if (!process.env.LUMA_API_KEY) return { matched: 0 };

  const lumaLink = await prisma.lumaLink.findUnique({ where: { userId } });
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const email = (lumaLink?.lumaGuestEmail || profile?.contactEmail || "").toLowerCase();
  if (!email) return { matched: 0 };

  const events = await prisma.eventCache.findMany({
    orderBy: { startAt: "desc" },
    take: 12,
  });

  let matched = 0;
  for (const event of events) {
    try {
      const guests = await listGuests(event.lumaEventId);
      const guest = guests.find((g) => {
        const gEmail = (g.email || g.user_email || "").toLowerCase();
        return gEmail === email;
      });
      if (!guest) continue;

      const status = guest.approval_status || "approved";
      const mapped =
        status === "approved" ? "going" : status;

      // Turn the "what are you working on" answer into demo history so
      // returning members see what they've brought to past Sundays.
      const workingOn = extractWorkingOn(
        guest.registration_answers,
        event.registrationQuestions as { id?: string; label?: string }[] | null
      );
      if (workingOn) {
        const dup = await prisma.demoHistory.findFirst({
          where: { userId, title: { equals: workingOn, mode: "insensitive" } },
        });
        if (!dup) {
          await prisma.demoHistory.create({
            data: {
              userId,
              title: workingOn,
              eventId: event.lumaEventId,
              createdAt: event.startAt,
            },
          });
        }
      }

      await prisma.attendance.upsert({
        where: {
          userId_lumaEventId: { userId, lumaEventId: event.lumaEventId },
        },
        create: {
          userId,
          lumaEventId: event.lumaEventId,
          status: mapped,
          registrationAnswers:
            (guest.registration_answers as Prisma.InputJsonValue) ?? undefined,
          lumaGuestId: guest.api_id || guest.guest_id || guest.id || null,
        },
        update: {
          status: mapped,
          registrationAnswers:
            (guest.registration_answers as Prisma.InputJsonValue) ?? undefined,
          lumaGuestId: guest.api_id || guest.guest_id || guest.id || null,
        },
      });
      matched += 1;
    } catch (e) {
      if (e instanceof LumaError && e.status === 404) continue;
      console.warn("[luma] attendance sync failed for", event.lumaEventId, e);
    }
  }

  await prisma.lumaLink.updateMany({
    where: { userId },
    data: { lastSyncedAt: new Date() },
  });

  return { matched };
}

/**
 * Luma guest answers look like
 * `{ label, question_id, value, question_type, answer }`. Pick the answer to
 * the working-on question, else the first free-text answer.
 */
export function extractWorkingOn(
  answers: unknown,
  questions: { id?: string; label?: string }[] | null | undefined
): string | null {
  if (!Array.isArray(answers)) return null;
  const rows = answers as {
    label?: string;
    question_id?: string;
    value?: unknown;
    answer?: unknown;
    question_type?: string;
  }[];
  const text = (r: { value?: unknown; answer?: unknown }) => {
    const v = r.answer ?? r.value;
    return typeof v === "string" ? v.trim() : "";
  };
  const q = findWorkingOnQuestion(questions);
  const byId = q?.id ? rows.find((r) => r.question_id === q.id) : undefined;
  const byLabel = rows.find((r) => /working on|work on|project|demo|building/i.test(r.label || ""));
  const firstText = rows.find((r) => text(r).length > 0);
  const pick = byId ?? byLabel ?? firstText;
  const out = pick ? text(pick) : "";
  return out.length > 0 && out.length <= 200 ? out : null;
}

export function findWorkingOnQuestion(
  questions: { id?: string; label?: string; question_type?: string }[] | null | undefined
) {
  if (!questions?.length) return null;
  const scored = questions
    .map((q) => {
      const label = (q.label || "").toLowerCase();
      let score = 0;
      if (label.includes("working on")) score += 10;
      if (label.includes("work on")) score += 8;
      if (label.includes("project")) score += 5;
      if (label.includes("demo")) score += 5;
      if (label.includes("building")) score += 4;
      return { q, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].q : questions[0];
}
