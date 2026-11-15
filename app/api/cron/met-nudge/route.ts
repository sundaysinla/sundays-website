import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Monday morning: everyone who was checked in yesterday gets one email asking
 * who they met, linking to /portal/met. Scheduled in vercel.json; protected by
 * CRON_SECRET (Vercel sends it as a bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") || "";
  if (!secret || header !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = Date.now();
  const events = await prisma.eventCache.findMany({
    where: { status: "active", startAt: { gte: new Date(now - 40 * 3600 * 1000), lte: new Date(now - 2 * 3600 * 1000) } },
  });

  let sent = 0;
  for (const event of events) {
    const rows = await prisma.attendance.findMany({
      where: { lumaEventId: event.lumaEventId, userId: { not: null } },
      select: { id: true, userId: true, checkedInAt: true, status: true, _count: { select: { meetingsA: true, meetingsB: true } } },
    });
    const anyCheckins = rows.some((r) => r.checkedInAt);
    const eligible = rows.filter(
      (r) => (anyCheckins ? !!r.checkedInAt : r.status === "going" || r.status === "walkin") && r._count.meetingsA + r._count.meetingsB === 0
    );

    for (const r of eligible) {
      const already = await prisma.notification.findFirst({
        where: { userId: r.userId!, type: "met_nudge", meta: { path: ["lumaEventId"], equals: event.lumaEventId } },
        select: { id: true },
      });
      if (already) continue;
      const when = event.startAt.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Los_Angeles" });
      await createNotification({
        userId: r.userId!,
        type: "met_nudge",
        title: "Who did you meet on Sunday?",
        body: `Thirty seconds: tap the people you talked to at ${event.title} on ${when}. It builds your met-graph and helps us introduce you to the right people next time.`,
        href: `/portal/met?event=${encodeURIComponent(event.lumaEventId)}`,
        meta: { lumaEventId: event.lumaEventId },
        emailSubject: "Who did you meet at Sundays?",
      });
      sent += 1;
    }
  }

  return Response.json({ ok: true, events: events.length, sent });
}
