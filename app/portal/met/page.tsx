import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/profile";
import { isLive, loadMetPicker, recentAttendedEvents, syncEventGuests } from "@/lib/attendance";
import { prisma } from "@/lib/db";
import { getUpcomingCachedEvent } from "@/lib/luma-sync";
import Eyebrow from "@/components/Eyebrow";
import Button from "@/components/Button";
import MetPicker from "@/components/portal/MetPicker";

export const dynamic = "force-dynamic";

export default async function MetPage({ searchParams }: { searchParams: Promise<{ event?: string }> | { event?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/login");
  await ensureProfile(session.user.id, session.user);
  const params = await Promise.resolve(searchParams);

  const upcoming = await getUpcomingCachedEvent();
  if (upcoming) {
    try {
      await syncEventGuests(upcoming.lumaEventId); // throttled; brings in Luma hosts and RSVPs
    } catch {
      // Luma being down shouldn't block the page
    }
  }
  const recent = await recentAttendedEvents(session.user.id, 21);
  const eventId = params.event ?? recent[0]?.lumaEventId ?? null;
  const event = eventId ? await prisma.eventCache.findUnique({ where: { lumaEventId: eventId } }) : null;
  const picker = event ? await loadMetPicker(session.user.id, event.lumaEventId) : null;
  const live = event ? isLive(event.startAt) : false;

  const when = event
    ? event.startAt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Los_Angeles" })
    : null;

  return (
    <div className="max-w-2xl space-y-10">
      <section className="space-y-3">
        <Eyebrow className="font-ui text-blueberry">People</Eyebrow>
        <h1 className="font-heading text-3xl lowercase leading-tight text-ink md:text-4xl">
          {event ? (live ? "who are you meeting?" : "who did you meet?") : "nothing to mark yet"}
        </h1>
        <p className="max-w-md font-body text-base text-ink/75">
          {event
            ? live
              ? `Everyone checked in at ${event.title} so far. Tap people as you talk to them, and jot what it was about while it's fresh. Only you see this.`
              : `Everyone checked in at ${event.title} on ${when}. Only you see this; it feeds your met-graph and, later, who we suggest you meet.`
            : "Once a host checks you in at a Sunday, the people in the room show up here."}
        </p>
        {recent.length > 1 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {recent.map((r) => (
              <Link
                key={r.lumaEventId}
                href={`/portal/met?event=${encodeURIComponent(r.lumaEventId)}`}
                className={
                  r.lumaEventId === event?.lumaEventId
                    ? "rounded-full border border-ink bg-ink px-3 pt-1.5 pb-1 font-ui text-[10px] uppercase tracking-wide text-paper"
                    : "rounded-full border border-ink/20 px-3 pt-1.5 pb-1 font-ui text-[10px] uppercase tracking-wide text-ink hover:bg-blueberry-200/30"
                }
              >
                {new Date(r.startAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })}
                {r.metCount ? ` · ${r.metCount}` : ""}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {event && picker ? (
        picker.me ? (
          <MetPicker eventId={event.lumaEventId} people={picker.people} anyCheckins={picker.anyCheckins} live={live} />
        ) : (
          <p className="font-body text-base text-ink/75">You&apos;re not checked in for that Sunday yet. Ask a host at the door and this page fills in.</p>
        )
      ) : null}

      <div className="border-t border-dashed border-ink/15 pt-6">
        <Button href="/portal/profile" variant="outline" size="md">
          See everyone you&apos;ve met
        </Button>
      </div>
    </div>
  );
}
